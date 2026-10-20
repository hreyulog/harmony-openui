# SPDX-License-Identifier: Apache-2.0
from pathlib import Path
import base64, hashlib, json, os, shutil, subprocess, urllib.request


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf8')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def outside_source(path, source):
    path, source = Path(path).resolve(), Path(source).resolve()
    try:
        path.relative_to(source)
    except ValueError:
        return path
    raise ValueError('Build outputs and private signing configuration must be outside the source checkout')


def fetch_dependencies(source, cache):
    cache = outside_source(cache, source)
    cache.mkdir(parents=True, exist_ok=True)
    lock = json.loads((Path(source) / 'tools/dependency-lock.json').read_text('utf8'))
    results = []
    for dependency in lock['dependencies']:
        target = cache / ('agenui-' + dependency['version'] + '.har')
        if not target.exists():
            request = urllib.request.Request(dependency['tarball'], headers={'User-Agent': 'harmony-openui-build'})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read()
        else:
            data = target.read_bytes()
        actual = sha256(data)
        integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
        if actual != dependency['sha256'] or integrity != dependency['integrity']:
            raise ValueError('Public dependency integrity mismatch: ' + dependency['name'])
        target.write_bytes(data)
        results.append({'name': dependency['name'], 'version': dependency['version'],
                        'sha256': actual, 'integrityVerified': True, 'path': str(target),
                        'source': dependency['tarball']})
    return results


def find_cli(value):
    if value:
        path = Path(value).resolve()
    elif os.environ.get('HARMONY_CLI_HOME'):
        path = Path(os.environ['HARMONY_CLI_HOME']).resolve()
    else:
        found = shutil.which('hvigorw.bat') or shutil.which('hvigorw')
        if not found:
            raise ValueError('Pass --cli-home or set HARMONY_CLI_HOME to the HarmonyOS command-line-tools directory')
        path = Path(found).resolve().parent.parent
    suffix = '.bat' if os.name == 'nt' else ''
    for name in ('ohpm', 'hvigorw'):
        if not (path / 'bin' / (name + suffix)).is_file():
            raise ValueError('Command-line-tools directory is missing ' + name)
    return path


def environment(cli, work, java_home=None, sdk_home=None):
    env = os.environ.copy()
    java = java_home or env.get('JAVA_HOME')
    sdk = sdk_home or env.get('DEVECO_SDK_HOME') or str(cli / 'sdk')
    if not java or not Path(java).is_dir():
        raise ValueError('Pass --java-home or set JAVA_HOME to a supported JDK/JBR')
    if not Path(sdk).is_dir():
        raise ValueError('Pass --sdk-home or set DEVECO_SDK_HOME to the installed HarmonyOS SDK directory')
    env['JAVA_HOME'] = str(java)
    env['DEVECO_SDK_HOME'] = str(sdk)
    env['PATH'] = str(Path(java) / 'bin') + os.pathsep + env.get('PATH', '')
    for key in ('TEMP', 'TMP', 'TMPDIR'):
        env[key] = str(work / 'temp')
    env['COREPACK_HOME'] = str(work / 'cache/corepack')
    env['NPM_CONFIG_CACHE'] = str(work / 'cache/npm')
    env['NODE_COMPILE_CACHE'] = str(work / 'cache/node-compile')
    (work / 'temp').mkdir(parents=True, exist_ok=True)
    return env


def run_logged(command, cwd, env, log):
    with Path(log).open('wb') as output:
        result = subprocess.run(command, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError('Command failed with exit code ' + str(result.returncode) + '; inspect the private log: ' + str(log))
