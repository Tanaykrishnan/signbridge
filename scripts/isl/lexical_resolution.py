"""Conservative English sense resolution to existing motions, never reviewed ISL grammar."""

# These are English destination cues, not sign IDs or a source of new sign assets.
PLACE_NOUNS = frozenset({
    'library', 'school', 'office', 'station', 'airport', 'hospital', 'home',
    'house', 'hotel', 'classroom', 'college', 'university', 'building',
    'bank', 'market', 'toilet', 'restaurant', 'park', 'shop',
})


def resolve_contextual_motion(word, words, vocabulary):
    if (word.text.casefold() != 'way' or word.upos != 'NOUN' or
            word.deprel != 'obj' or 'direction' not in vocabulary):
        return None
    head = next((w for w in words if w.id == word.head), None)
    if not head or head.upos != 'VERB' or (head.lemma or head.text).casefold() != 'show':
        return None
    for destination in words:
        if (destination.upos != 'NOUN' or
                (destination.lemma or destination.text).casefold() not in PLACE_NOUNS):
            continue
        attached = ((destination.head == word.id and destination.deprel == 'nmod') or
                    (destination.head == head.id and destination.deprel == 'obl'))
        spatial_to = any(w.head == destination.id and w.upos == 'ADP' and
                         w.deprel == 'case' and w.text.casefold() == 'to' for w in words)
        if attached and spatial_to:
            identity, label = vocabulary['direction']
            return identity, label, {
                'source': word.text, 'target': label,
                'rule': 'spatial-directions-v1', 'review': 'unreviewed',
            }
    return None
