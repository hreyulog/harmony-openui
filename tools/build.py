# SPDX-License-Identifier: Apache-2.0
"""Build in a fresh directory outside the checkout, with optional private signing."""
from pathlib import Path
import argparse, datetime, json, os, re, shutil, subprocess, tarfile, zipfile
from build_common import environment, fetch_dependencies, find_cli, outside_source, run_logged, sha256, write_json


def snapshot(source, destination, target):
    names = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).decode().split('\0')
    rows = []
    blocked = {'.p12', '.pfx', '.key', '.pem', '.cer', '.p7b'}
    for name in sorted(set(filter(None, names))):
        if target == 'har' and name.startswith(('demo/', 'docs/', 'tests/')):
            continue
        path = source / name
        if not path.is_file():
            continue
        if path.suffix.lower() in blocked or '.private.' in path.name or path.name == 'agconnect-services.json':
            raise ValueError('Private configuration must not be tracked or included in a source snapshot')
        data = path.read_bytes()
        staged_path = destination / name
        staged_path.parent.mkdir(parents=True, exist_ok=True)
        staged_path.write_bytes(data)
        rows.append({'path': name, 'sha256': sha256(data), 'bytes': len(data)})
    changed = [row['path'] for row in rows if sha256((source / row['path']).read_bytes()) != row['sha256']]
    if changed:
        raise RuntimeError('Source changed while freezing; preserve this run and use a new work directory')
    return rows


def apply_private_signing(stage, private_path, original_source):
    path = outside_source(private_path, original_source)
    config = json.loads(path.read_text('utf-8-sig'))
    if not isinstance(config, dict) or not isinstance(config.get('name'), str) or not isinstance(config.get('material'), dict):
        raise ValueError('Signing JSON must contain one signing configuration with name, type, and material')
    material = config['material']
    for key in ('certpath', 'profile', 'storeFile'):
        if key not in material or not Path(material[key]).is_file():
            raise ValueError('Private signing material is unavailable: ' + key)
    # Read the signed profile payload without changing it. The SDK verifies its signature.
    profile_text = Path(material['profile']).read_bytes().decode('utf8', errors='replace')
    decoder, bundle_info = json.JSONDecoder(), None
    for offset, character in enumerate(profile_text):
        if character != '{':
            continue
        try:
            candidate, _ = decoder.raw_decode(profile_text[offset:])
        except (ValueError, TypeError):
            continue
        if isinstance(candidate, dict) and isinstance(candidate.get('bundle-info'), dict):
            bundle_info = candidate['bundle-info']
            break
    expected_bundle = json.loads((stage / 'AppScope/app.json5').read_text('utf8'))['app']['bundleName']
    if bundle_info is None or bundle_info.get('bundle-name') != expected_bundle:
        raise ValueError('Private signing profile must match this independent demo bundle exactly')
    build = json.loads((stage / 'build-profile.json5').read_text('utf8'))
    build['app']['signingConfigs'] = [config]
    for product in build['app']['products']:
        product['signingConfig'] = config['name']
    write_json(stage / 'build-profile.json5', build)



def verify_installed_dependencies(stage, dependencies):
    """Compare OHPM-installed bytes with the independently verified public archive."""
    verified = []
    for dependency in dependencies:
        root = stage / 'openui/oh_modules' / dependency['name']
        count = 0
        with tarfile.open(dependency['path']) as archive:
            for entry in archive.getmembers():
                if not entry.isfile() or not entry.name.startswith('package/'):
                    continue
                name = entry.name[len('package/'):]
                installed = root / name
                if not installed.is_file() or installed.read_bytes() != archive.extractfile(entry).read():
                    raise RuntimeError('Installed public dependency differs from the pinned archive: ' + dependency['name'] + '/' + name)
                count += 1
        verified.append({'name': dependency['name'], 'version': dependency['version'], 'filesVerified': count})
    return verified



def stage_distribution_notices(source, stage):
    notices = []
    for filename in ('LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES'):
        original = source / filename
        if not original.is_file():
            notices.append({'name': filename, 'present': False})
            print('Distribution notice is not ready: ' + filename + ' (diagnostic build only)', flush=True)
            continue
        data = original.read_bytes()
        (stage / 'openui' / filename).write_bytes(data)
        notices.append({'name': filename, 'present': True, 'sha256': sha256(data)})
    third_party = source / 'third_party'
    entries = sorted(path for path in third_party.rglob('*') if path.is_file()) if third_party.is_dir() else []
    if not entries:
        notices.append({'name': 'third_party/', 'present': False})
        print('Third-party license directory is not ready (diagnostic build only)', flush=True)
    for original in entries:
        name = original.relative_to(source).as_posix()
        data = original.read_bytes()
        target = stage / 'openui' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        notices.append({'name': name, 'present': True, 'sha256': sha256(data)})
    if (stage / 'demo/src/main').is_dir():
        raw = stage / 'demo/src/main/resources/rawfile/openui-licenses'
        for notice in notices:
            if notice['present']:
                target = raw / notice['name']
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(stage / 'openui' / notice['name'], target)
    return notices


def verify_har_notices(artifact, notices):
    with tarfile.open(artifact) as archive:
        names = set(archive.getnames())
        for notice in notices:
            if not notice['present']:
                continue
            name = 'package/' + notice['name']
            if name not in names or sha256(archive.extractfile(name).read()) != notice['sha256']:
                raise RuntimeError('HAR distribution notice is missing or differs: ' + notice['name'])
    return all(notice['present'] for notice in notices)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-dir', required=True, help='A new output directory outside the checkout')
    parser.add_argument('--target', choices=('har', 'demo', 'all'), default='har')
    parser.add_argument('--cli-home')
    parser.add_argument('--sdk-home')
    parser.add_argument('--java-home')
    parser.add_argument('--node', help='Node executable used for OpenUI Lang bundling')
    parser.add_argument('--pnpm', help='pnpm executable; otherwise pnpm or Corepack is located on PATH')
    parser.add_argument('--signing-config', help='Private JSON configuration outside the checkout, matching the independent demo bundle')
    parser.add_argument('--unsigned', action='store_true', help='Explicitly allow a demo HAP without signing')
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1]
    work = outside_source(args.work_dir, source)
    if work.exists():
        raise ValueError('Use a new work directory; existing build evidence is never overwritten')
    if args.target in ('demo', 'all') and not args.signing_config and not args.unsigned:
        raise ValueError('Demo builds require --signing-config or explicit --unsigned')
    cli = find_cli(args.cli_home)
    work.mkdir(parents=True)
    stage, logs, artifacts = work / 'stage', work / 'logs', work / 'artifacts'
    for path in (stage, logs, artifacts):
        path.mkdir()
    env = environment(cli, work, args.java_home, args.sdk_home)
    print('Freezing public source into a new external build directory', flush=True)
    rows = snapshot(source, stage, args.target)
    source_manifest = {'frozenAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       'sourceCommit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD']).decode().strip(),
                       'files': rows, 'sourceModified': False, 'target': args.target,
                       'excludedFromHarSnapshot': ['demo/', 'docs/', 'tests/'] if args.target == 'har' else []}
    write_json(work / 'source-manifest.json', source_manifest)
    notices = stage_distribution_notices(stage, stage)
    write_json(work / 'distribution-notices.json', notices)
    if args.target == 'har':
        profile = json.loads((stage / 'build-profile.json5').read_text('utf8'))
        profile['modules'] = [module for module in profile['modules'] if module['name'] == 'openui']
        write_json(stage / 'build-profile.json5', profile)
    dependencies = fetch_dependencies(source, work / 'downloads')
    write_json(work / 'dependency-receipt.json', dependencies)
    if args.signing_config:
        apply_private_signing(stage, args.signing_config, source)

    lang_builder = stage / 'tools/build-lang.mjs'
    if lang_builder.exists():
        node = args.node or shutil.which('node')
        if not node:
            raise ValueError('Pass --node or add Node to PATH for the OpenUI Lang bundle')
        env['PATH'] = str(Path(node).resolve().parent) + os.pathsep + env.get('PATH', '')
        pnpm = args.pnpm or shutil.which('pnpm.cmd') or shutil.which('pnpm')
        if pnpm:
            command = [pnpm]
        else:
            corepack = shutil.which('corepack.cmd', path=env['PATH']) or shutil.which('corepack', path=env['PATH'])
            if not corepack:
                raise ValueError('Pass --pnpm or install Corepack/pnpm; source dependencies are installed only in the build stage')
            command = [corepack, 'pnpm']
        print('Installing pinned OpenUI Lang build dependencies in the stage', flush=True)
        run_logged([*command, 'install', '--frozen-lockfile', '--ignore-scripts', '--store-dir', str(work / 'cache/pnpm-store')], stage, env, logs / 'pnpm.private.log')
        run_logged([node, str(lang_builder)], stage, env, logs / 'lang-bundle.private.log')
        if not (stage / 'openui/src/main/ets/generated/OpenUiLangRuntime.js').is_file():
            raise RuntimeError('OpenUI Lang runtime bundle was not generated')

    suffix = '.bat' if os.name == 'nt' else ''
    print('Installing public OHPM dependencies in the stage', flush=True)
    run_logged([str(cli / 'bin' / ('ohpm' + suffix)), 'install', '--all', '--registry',
                'https://ohpm.openharmony.cn/ohpm', '--cache', str(work / 'cache/ohpm')], stage, env, logs / 'ohpm.private.log')
    installed_dependencies = verify_installed_dependencies(stage, dependencies)
    write_json(work / 'installed-dependency-receipt.json', installed_dependencies)
    targets = ['har', 'demo'] if args.target == 'all' else [args.target]
    results = []
    for target in targets:
        module = 'openui' if target == 'har' else 'demo'
        task = 'assembleHar' if target == 'har' else 'assembleHap'
        print('Building ' + target + ' (private log)', flush=True)
        run_logged([str(cli / 'bin' / ('hvigorw' + suffix)), task, '--mode', 'module', '-p',
                    'product=default', '-p', 'module=' + module + '@default', '-p',
                    'buildMode=debug', '--no-daemon'], stage, env, logs / (target + '.private.log'))
        output = stage / module / 'build/default/outputs/default'
        if target == 'har':
            matches = list(output.glob('*.har'))
        else:
            matches = list(output.glob('*-signed.hap' if args.signing_config else '*-unsigned.hap'))
        if len(matches) != 1:
            raise RuntimeError('Expected one ' + target + ' artifact; inspect the private build output')
        built = matches[0]
        version = json.loads((stage / 'openui/oh-package.json5').read_text('utf8'))['version']
        label = 'harmony-openui-' + version + '.har' if target == 'har' else 'harmony-openui-demo-' + version + ('-signed.hap' if args.signing_config else '-unsigned.hap')
        artifact = artifacts / label
        shutil.copy2(built, artifact)
        result = {'target': target, 'artifact': str(artifact.relative_to(work)), 'sha256': sha256(artifact.read_bytes()), 'bytes': artifact.stat().st_size}
        if target == 'har':
            result['distributionNoticesComplete'] = verify_har_notices(artifact, notices)
        if target == 'demo':
            with zipfile.ZipFile(artifact) as hap:
                for notice in notices:
                    if notice['present']:
                        entry = 'resources/rawfile/openui-licenses/' + notice['name']
                        if sha256(hap.read(entry)) != notice['sha256']:
                            raise RuntimeError('Demo HAP distribution notice differs: ' + notice['name'])
                result['distributionNoticesComplete'] = all(notice['present'] for notice in notices)
            with tarfile.open(dependencies[0]['path']) as archive, zipfile.ZipFile(artifact) as hap:
                natives = [entry for entry in archive.getmembers() if entry.isfile() and entry.name.startswith('package/libs/arm64-v8a/') and entry.name.endswith('.so')]
                for entry in natives:
                    packaged = 'libs/arm64-v8a/' + Path(entry.name).name
                    if sha256(hap.read(packaged)) != sha256(archive.extractfile(entry).read()):
                        raise RuntimeError('Packaged public AGenUI native library mismatch: ' + packaged)
                result['publicNativeLibrariesVerified'] = len(natives)
                result['signed'] = bool(args.signing_config)
        results.append(result)
    receipt = {'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'sourceManifest': 'source-manifest.json', 'dependencies': 'dependency-receipt.json',
               'installedDependencies': 'installed-dependency-receipt.json',
               'artifacts': results, 'sourceModified': False, 'installed': False,
               'privateSigningInjectedOnlyInStage': bool(args.signing_config)}
    write_json(work / 'build-receipt.json', receipt)
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__':
    main()
