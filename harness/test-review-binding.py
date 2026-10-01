"""A review must become stale when a frame, reference or geometry changes."""
import tempfile
import unittest
from pathlib import Path
from review_binding import review_fingerprint

class ReviewBindingTests(unittest.TestCase):
    def test_review_tracks_every_runtime_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'curated').mkdir()
            contents={'sprite-request.json':b'request','runtime-metrics.json':b'geometry','base-source.png':b'reference','curated/idle-frame-0.png':b'pose'}
            for name,data in contents.items(): (root/name).write_bytes(data)
            initial=review_fingerprint(root)
            self.assertEqual(review_fingerprint(root),initial)
            for name,data in contents.items():
                (root/name).write_bytes(data+b'changed')
                self.assertNotEqual(review_fingerprint(root),initial,name)
                (root/name).write_bytes(data)

if __name__=='__main__': unittest.main()
