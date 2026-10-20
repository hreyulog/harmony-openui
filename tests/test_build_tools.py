# SPDX-License-Identifier: Apache-2.0
"""Artifact boundaries checked without SDK, network, or signing material."""
from pathlib import Path
import importlib.util
import subprocess
import sys
import tempfile
import unittest

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('openui_build', TOOLS / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class SnapshotBoundaryTests(unittest.TestCase):
    def test_har_omits_parallel_demo_docs_and_test_edits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, stage = root / 'source', root / 'stage'
            source.mkdir()
            subprocess.run(['git', 'init', '-q', str(source)], check=True)
            expected = {'.gitignore', 'openui/Index.ets', 'tools/build.py'}
            for name in sorted(expected | {'demo/main.ets', 'docs/guide.md', 'tests/check.mjs'}):
                path = source / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture\n', 'utf8')
            rows = build.snapshot(source, stage, 'har')
            self.assertEqual({row['path'] for row in rows}, expected)
            self.assertFalse((stage / 'demo').exists())
            self.assertFalse((stage / 'docs').exists())
            self.assertFalse((stage / 'tests').exists())
            full = build.snapshot(source, root / 'full-stage', 'all')
            self.assertEqual(len(full), 6)

    def test_build_and_private_signing_paths_cannot_enter_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            source.mkdir()
            for path in (source, source / 'private' / 'signing.json'):
                with self.assertRaises(ValueError):
                    build.outside_source(path, source)
            self.assertEqual(build.outside_source(source.parent / 'external', source), source.parent / 'external')


if __name__ == '__main__':
    unittest.main()
