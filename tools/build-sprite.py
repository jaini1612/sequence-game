"""Builds client/public/cards.svg from the English-pattern deck sheet.

The sheet is a 13x4 grid of cards, each drawn by one top-level <g> positioned with a translate.
Columns run A,2..10,J,Q,K; rows are spades, hearts, diamonds, clubs. Rather than trust the group
transforms (one Jack is offset differently), every card is located by the global position of its
white background rect.

Output symbols:
  #face-<RANK><SUIT>  the 12 court cards, complete with their own border and indices
  #pip-<SUIT>         one suit pip, squashed to 85% height to correct the sheet's elongation
"""
import re
import sys
import xml.etree.ElementTree as ET

NS = 'http://www.w3.org/2000/svg'
SVG = '{%s}' % NS
ET.register_namespace('', NS)

src, dest = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()

CARD_W, CARD_H = 359.0, 539.0
SUITS = ['S', 'H', 'D', 'C']
COURT = {10: 'J', 11: 'Q', 12: 'K'}
# The sheet draws every pip 60 wide by 90 tall. Real pips are nowhere near that tall.
PIP_W, PIP_H = 60.0, 90.0
PIP_SQUASH = 0.85


def group_offset(g):
    s = g.attrib.get('transform', '')
    m = re.match(r'translate\(([-\d.]+),([-\d.]+)\)', s)
    if m:
        return float(m.group(1)), float(m.group(2))
    m = re.match(r'matrix\(([-\d.,\s]+)\)', s)
    n = [float(v) for v in re.split(r'[,\s]+', m.group(1).strip())]
    return n[4], n[5]


def background_rect(g):
    """The card's own white backing, identified by its size - court cards contain other white rects."""
    for el in g.iter(SVG + 'rect'):
        try:
            w, h = float(el.attrib['width']), float(el.attrib['height'])
        except (KeyError, ValueError):
            continue
        if abs(w - CARD_W) < 2 and abs(h - CARD_H) < 2:
            return el
    return None


cards = {}
for g in [c for c in root if c.tag == SVG + 'g']:
    dx, dy = group_offset(g)
    rect = background_rect(g)
    if rect is not None:
        gx, gy = float(rect.attrib['x']) + dx, float(rect.attrib['y']) + dy
    else:
        # The clubs Jack is the one card with no white backing rect, and its group is translated
        # straight to the card's corner rather than into the shared 570-tall row space.
        gx, gy = dx + 0.5, dy + 0.5
    col, row = round((gx - 30.5) / 390), round((gy - 30.5) / 570)
    cards[(col, row)] = (g, gx, gy)

missing = [k for k in [(c, r) for c in COURT for r in range(4)] if k not in cards]
if missing:
    raise SystemExit(f'court cards not located: {missing}')

out = ET.Element(SVG + 'svg', {'xmlns': NS, 'aria-hidden': 'true'})
defs = ET.SubElement(out, SVG + 'defs')

for (col, row), (g, gx, gy) in sorted(cards.items()):
    if col not in COURT:
        continue
    name = f'face-{COURT[col]}{SUITS[row]}'
    sym = ET.SubElement(defs, SVG + 'symbol', {
        'id': name,
        'viewBox': f'{gx} {gy} {CARD_W} {CARD_H}',
    })
    sym.append(g)

# One pip per suit, taken from that suit's Ace: the only path whose box is exactly 60x90.
for row, suit in enumerate(SUITS):
    ace = cards[(0, row)][0]
    # An Ace holds five paths: two rank glyphs, two small index pips and the big centre pip. Only
    # the centre pip starts inside the middle of the card, which is how we tell them apart.
    pip = None
    for p in ace.iter(SVG + 'path'):
        m = re.match(r'[mM]\s*([-\d.]+),([-\d.]+)', p.attrib.get('d', ''))
        if not m:
            continue
        x, y = float(m.group(1)), float(m.group(2))
        if 170 <= x <= 215 and 730 <= y <= 830:
            pip = p
            break
    if pip is None:
        raise SystemExit(f'centre pip not found for {suit}')

    sym = ET.SubElement(defs, SVG + 'symbol', {
        'id': f'pip-{suit}',
        'viewBox': f'0 0 {PIP_W} {PIP_H * PIP_SQUASH}',
    })
    path = ET.SubElement(sym, SVG + 'path', {
        'd': pip.attrib['d'],
        # Move the pip's box to the origin, then take 15% off its height.
        'transform': f'scale(1,{PIP_SQUASH}) translate(-150,-737.36218)',
        'fill': 'currentColor',
    })

ET.ElementTree(out).write(dest, encoding='utf-8', xml_declaration=True)
print(f'wrote {dest}')
