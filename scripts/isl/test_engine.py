"""Real local-model checks. These test mechanics, not linguistic accuracy."""

import io
import pickle
import unittest

import numpy as np

from assets import NumericUnpickler
from engine import CoverageError, Engine, aliases


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = Engine()

    def test_release_loaded(self):
        self.assertEqual(len(self.engine.labels), 1997)
        self.assertNotIn('a', self.engine.vocabulary)
        self.assertNotIn('b', self.engine.vocabulary)
        self.assertNotEqual(self.engine.vocabulary['i'][0], self.engine.labels['I'])
        self.assertEqual(self.engine.vocabulary['i'][1], 'I (Person)')

    def test_new_combinations_and_paragraph(self):
        text = 'What is your name? I am a student. Where is the blue building?'
        plans = self.engine.plan(text)
        self.assertEqual([p['labels'] for p in plans],
                         [['Your', 'Name', 'What'], ['I (Person)', 'Student'], ['Blue', 'Building', 'Where']])
        self.assertEqual(plans[-1]['end'], len(text))
        self.assertTrue(all(p['ids'] for p in plans))

    def test_negation_is_preserved(self):
        affirmative = self.engine.plan('I like water.')[0]['labels']
        negative = self.engine.plan('I do not like water.')[0]['labels']
        self.assertNotEqual(affirmative, negative)
        self.assertIn('No', negative)
        self.assertIn('Water', negative)
        self.assertIn('Like', negative)

    def test_tense_is_not_silently_dropped(self):
        self.assertIn('Future Tense', self.engine.plan('I will go to school.')[0]['labels'])
        self.assertIn('Past Tense', self.engine.plan('I went to school.')[0]['labels'])
        self.assertIn('Tomorrow', self.engine.plan('I go to school tomorrow.')[0]['labels'])

    def test_missing_words_block_whole_input(self):
        for text in ['Hello. Kattankulathur.', 'My name is Zzyqx.', 'I study quantumfluff.']:
            with self.assertRaises(CoverageError):
                self.engine.plan(text)

    def test_spatial_way_uses_existing_direction_motion_with_unreviewed_evidence(self):
        for text in ['Show me the way to the library.', 'Can you show the way to school?',
                     'Show me the way to the blue building.', 'Do not show me the way to the library.']:
            plan = self.engine.plan(text)[0]
            self.assertIn('Direction', plan['labels'])
            self.assertIn(self.engine.vocabulary['direction'][0], plan['ids'])
            self.assertEqual(plan['lexicalMappings'], [{
                'source': 'way', 'target': 'Direction', 'rule': 'spatial-directions-v1',
                'review': 'unreviewed',
            }])
        self.assertIn('No', self.engine.plan('Do not show me the way to the library.')[0]['labels'])

    def test_way_sense_is_not_guessed_or_resolved_across_clauses(self):
        for text in ['What is the way to learn science?', 'Show the way to solve this problem.',
                     'You show me the way to improve school.', 'The library is on my way to school.',
                     'Show me the way to success.', 'Show me the way for school.',
                     'Show the way. I go to school.', 'Show me the way to Kattankulathur.']:
            with self.assertRaises(CoverageError):
                self.engine.plan(text)

    def test_context_mapping_does_not_hide_other_unknown_words(self):
        with self.assertRaises(CoverageError) as result:
            self.engine.plan('Show me the way to the library. My name is Zzyqx.')
        self.assertIn('Zzyqx', result.exception.words)
        self.assertNotIn('way', result.exception.words)

    def test_no_single_letter_spelling_and_no_semantic_alias_guessing(self):
        self.assertEqual(aliases('Left (Abandon)'), ['left (abandon)'])
        self.assertEqual(aliases('Eat [VEB]/Food'), ['eat', 'food'])
        with self.assertRaises(CoverageError):
            self.engine.plan('A B C')

    def test_bad_inputs(self):
        for value in ['', ' ', 'x' * 5001, None]:
            with self.assertRaises(ValueError):
                self.engine.plan(value)

    def test_known_words_over_limit_are_not_vocabulary_errors(self):
        with self.assertRaisesRegex(ValueError, '24 sign units') as result:
            self.engine.plan('I like water ' * 10 + '.')
        self.assertNotIsInstance(result.exception, CoverageError)

    def test_actual_inference_differs_and_is_finite(self):
        motions = [self.engine.decode([self.engine.vocabulary[word][0]]) for word in ['hello', 'water']]
        for motion in motions:
            poses = np.asarray(motion['poses'])
            self.assertEqual(poses.shape[1:], (51, 3))
            self.assertTrue(np.isfinite(poses).all())
            self.assertGreater(float(np.max(np.std(poses, axis=0))), 0.01)
            self.assertTrue(np.all(np.diff(motion['times']) > 0))
        self.assertNotEqual(motions[0]['poses'][0], motions[1]['poses'][0])

    def test_pickle_global_restriction(self):
        with self.assertRaises(pickle.UnpicklingError):
            NumericUnpickler(io.BytesIO(pickle.dumps(eval))).load()


if __name__ == '__main__':
    unittest.main(verbosity=2)
