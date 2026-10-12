"""Local SignVQVAE inference with explicit vocabulary coverage and no alphabet fallback.

The gloss planner is an experimental English dependency heuristic, NOT a reviewed ISL
translator. The decoder reconstructs learned isolated ISL motions and their transitions.
"""

import csv
import re
import sys

import numpy as np
import torch

from assets import DATA, numeric_pickle, verify_assets
from lexical_resolution import resolve_contextual_motion

PROCESSORS = {'tokenize': 'ewt', 'mwt': 'ewt', 'pos': 'ewt_nocharlm',
              'lemma': 'ewt_nocharlm', 'depparse': 'ewt_nocharlm'}


class CoverageError(ValueError):
    def __init__(self, words):
        self.words = list(dict.fromkeys(words))
        super().__init__('No available ISL motion for: ' + ', '.join(self.words[:30]) +
                         '. Nothing was omitted or fingerspelled. Try different wording.')


def key(text):
    return re.sub(r'\s+', ' ', text.casefold().strip()).replace('\u2019', "'")


def aliases(label):
    # Only strip the dataset's POS marker; semantic disambiguators stay intact.
    cleaned = re.sub(r'\s*\[(?:VEB|VERB|NOUN|ADJ)\]', '', label, flags=re.I)
    return [key(part) for part in cleaned.split('/') if len(key(part)) > 1 or key(part).isdigit()]


def inverse_hands(data):
    out = np.zeros((len(data), 51, 3), dtype=np.float32)
    out[:, :9] = data[:, :9]
    def unit(v):
        norm = np.linalg.norm(v, axis=-1, keepdims=True)
        if np.any(norm < 1e-7):
            raise ValueError('Degenerate hand basis in decoded motion')
        return v / norm
    for source, dest, anchor, left in [(15, 9, 9, True), (36, 30, 12, False)]:
        wrist, middle, little = (data[:, anchor + i] for i in range(3))
        q, v = unit(middle - wrist), unit(little - wrist)
        r = unit(np.cross(v, q) if left else np.cross(q, v))
        p = unit(np.cross(q, r))
        scale = np.linalg.norm(middle - wrist, axis=-1) * 2.5
        basis = np.stack((p, q, r), axis=1) * scale[:, None, None]
        out[:, dest:dest + 21] = np.einsum(
            'tij,tjk->tik', data[:, source:source + 21] - [0.5, 0, 0.5], basis
        ) + wrist[:, None]
    if not np.isfinite(out).all():
        raise ValueError('Non-finite decoded motion')
    return out


class Engine:
    def __init__(self, with_parser=True):
        verify_assets()
        torch.set_num_threads(4)
        sys.path.insert(0, str(DATA))
        from upstream.SignVQVAE import Model
        from upstream.model_params import SignVQVAEParams
        self.model = Model(*SignVQVAEParams(None, 3, torch.device('cpu')).get_model_params())
        checkpoint = torch.load(DATA / 'model_best_loss.pt', map_location='cpu', weights_only=True)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()
        del checkpoint
        self.codes = numeric_pickle('encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_filtered.pkl')
        self.trims = numeric_pickle('encoded_data_FDMSE-ISL_SignVQVAE_241108_1706_trim_info_filtered.pkl')
        self.vocabulary = {}
        self.labels = {}
        with (DATA / 'metadata_fdmse_filtered.csv').open(encoding='utf-8-sig', newline='') as source:
            for row in csv.DictReader(source):
                identity = row['id']
                if identity not in self.codes:
                    continue
                code = self.codes[identity]
                if not isinstance(code, np.ndarray) or code.dtype.kind not in 'iu' or code.size % 3:
                    raise ValueError('Unexpected numeric code array')
                if code.min() < 0 or code.max() >= 1024:
                    raise ValueError('Invalid VQ code index')
                self.labels.setdefault(row['class'], identity)
                for alias in aliases(row['class']):
                    self.vocabulary.setdefault(alias, (identity, row['class']))
        # FDMSE has separate entries for alphabet I and the personal pronoun.
        # Never route an English pronoun to the alphabet entry.
        self.vocabulary['i'] = self.vocabulary['i (person)']
        self.nlp = None
        if with_parser:
            import stanza
            self.nlp = stanza.Pipeline('en', dir=str(DATA / 'stanza'), processors=PROCESSORS,
                                       package=None, use_gpu=False, download_method=None,
                                       verbose=False)

    def plan(self, text):
        if not self.nlp:
            raise RuntimeError('English parser not loaded')
        if not isinstance(text, str) or not text.strip() or len(text.encode('utf-16-le')) // 2 > 5000:
            raise ValueError('Enter 1 to 5,000 characters of English text.')
        doc = self.nlp(text)
        unknown, plans = [], []
        substitutions = {"n't": 'no', 'not': 'no', 'us': 'we', 'them': 'they'}
        for sentence in doc.sentences:
            words = sentence.words
            units, removed, lexical_mappings = [], [], []
            i = 0
            while i < len(words):
                word = words[i]
                surface, lemma = key(word.text), key(word.lemma or word.text)
                if word.upos == 'PUNCT':
                    i += 1
                    continue
                match = None
                for count in range(min(5, len(words) - i), 0, -1):
                    chunk = words[i:i + count]
                    if any(w.upos == 'PUNCT' for w in chunk):
                        continue
                    phrase = ' '.join(key(w.text) for w in chunk)
                    if phrase in self.vocabulary:
                        match = (count, self.vocabulary[phrase])
                        break
                if match:
                    count, (identity, label) = match
                    units.append({'id': identity, 'label': label, 'word': word,
                                  'indices': set(w.id for w in words[i:i + count])})
                    i += count
                    continue
                resolved = resolve_contextual_motion(word, words, self.vocabulary)
                if resolved:
                    identity, label, evidence = resolved
                    units.append({'id': identity, 'label': label, 'word': word, 'indices': {word.id}})
                    lexical_mappings.append(evidence)
                    i += 1
                    continue
                # Articles and grammatical support auxiliaries have no standalone output here.
                # Negation, modal meaning, possessives and prepositions are never blanket-filtered.
                if (surface in {'a', 'an', 'the'} and word.upos == 'DET') or (
                    word.upos == 'AUX' and lemma in {'be', 'do'}
                ):
                    removed.append(word.text)
                    i += 1
                    continue
                candidate = 'future tense' if word.upos == 'AUX' and lemma == 'will' else substitutions.get(surface, lemma)
                if candidate in self.vocabulary and not (
                    word.upos == 'PROPN' and surface not in self.vocabulary
                ):
                    identity, label = self.vocabulary[candidate]
                    units.append({'id': identity, 'label': label, 'word': word, 'indices': {word.id}})
                else:
                    unknown.append(word.text)
                i += 1
            # Reorder only a single-clause dependency parse; don't shuffle embedded clauses
            # into an incorrect flat SOV sentence. Complex clauses keep lexical order, flagged below.
            verbs = [w for w in words if w.upos == 'VERB']
            complex_clause = any(w.deprel.split(':')[0] in {'ccomp', 'advcl', 'acl', 'conj', 'xcomp'} for w in words)
            questions = {'what', 'where', 'who', 'whom', 'whose', 'which', 'when', 'why', 'how'}
            if len(verbs) <= 1 and not complex_clause:
                predicates = [u for u in units if u['word'].upos == 'VERB']
                query = [u for u in units if key(u['word'].text) in questions]
                others = [u for u in units if u not in predicates and u not in query]
                units = others + predicates + query
            # Preserve explicitly inflected past/future information as dataset tense signs.
            temporal = any(key(w.text) in {'yesterday', 'today', 'tomorrow', 'past', 'future'} for w in words)
            if not temporal and any('Tense=Past' in (w.feats or '') for w in words):
                identity, label = self.vocabulary['past tense']
                units.insert(0, {'id': identity, 'label': label})
            if not units:
                unknown.append(sentence.text)
            if len(units) > 24:
                raise ValueError('A sentence exceeds 24 sign units. Split it into shorter sentences.')
            start = sentence.tokens[0].start_char
            end = sentence.tokens[-1].end_char
            plans.append({'start': len(text[:start].encode('utf-16-le')) // 2,
                          'end': len(text[:end].encode('utf-16-le')) // 2,
                          'labels': [u['label'] for u in units],
                          'ids': [u['id'] for u in units],
                          'omittedFunctionWords': removed,
                          'lexicalMappings': lexical_mappings,
                          'complexClause': complex_clause})
        if unknown:
            raise CoverageError(unknown)
        if len(plans) > 64 or sum(len(p['ids']) for p in plans) > 160:
            raise ValueError('Use at most 64 sentences / 160 sign units per request.')
        return plans

    @torch.inference_mode()
    def decode(self, identities):
        pieces = []
        for i, identity in enumerate(identities):
            codes = self.codes[identity].reshape(3, -1)
            start, end = self.trims.get(identity, [0, codes.shape[1]])
            # Trim inter-sign rests using the authors' three-code feathering convention.
            lo = int(start) + 3 if i > 0 else 0
            hi = int(end) - 3 if i < len(identities) - 1 else codes.shape[1]
            if hi - lo < 4:
                lo, hi = 0, codes.shape[1]
            pieces.append(codes[:, lo:hi])
        sequence = np.concatenate(pieces, axis=1).reshape(1, -1)
        if sequence.shape[1] > 2700:
            raise ValueError('Decoded sentence would exceed one minute. Split it into shorter sentences.')
        output = self.model.forward_decoder(torch.from_numpy(sequence.astype(np.int64)))
        poses = inverse_hands(output[0].cpu().numpy().reshape(-1, 57, 3))
        # Keep every other frame, including the last; playback is 30 source frames/second.
        indices = list(range(0, len(poses), 2))
        if indices[-1] != len(poses) - 1:
            indices.append(len(poses) - 1)
        return {'times': [round(i / 30, 6) for i in indices],
                'poses': np.round(poses[indices], 6).tolist()}

    def generate(self, text):
        plans = self.plan(text)
        segments = []
        duration = 0
        for plan in plans:
            motion = self.decode(plan['ids'])
            duration += motion['times'][-1]
            if duration > 600:
                raise ValueError('Motion exceeds ten minutes. Split the text into sections.')
            segments.append({**plan, **motion})
        return {'sourceText': text, 'segments': segments,
                'vocabularySize': len(self.labels), 'version': 'SignVQVAE_241108_1706'}
