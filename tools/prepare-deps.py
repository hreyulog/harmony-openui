# SPDX-License-Identifier: Apache-2.0
"""Fetch and verify the public pinned AGenUI dependency; does not build or sign."""
from pathlib import Path
import argparse, json
from build_common import fetch_dependencies, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, help='Dependency cache outside the source checkout')
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1]
    results = fetch_dependencies(source, args.cache_dir)
    write_json(Path(args.cache_dir) / 'dependency-receipt.json', results)
    print(json.dumps([{'name': item['name'], 'version': item['version'], 'sha256': item['sha256'],
                       'integrityVerified': item['integrityVerified']} for item in results]))


if __name__ == '__main__':
    main()
