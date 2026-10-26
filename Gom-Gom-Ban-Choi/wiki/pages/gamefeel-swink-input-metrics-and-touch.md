---
type: book-topic
source: gamefeel-swink
fit_g1: medium
tags: [book, gamefeel-swink]
---
# Input metrics, direct vs indirect input, and the future of input

Source: [[gamefeel-swink-src]], Ch. 5 (pp. 85-89), Ch. 6 (pp. 101-118), Ch. 19 input (pp. 321-328), Ch. 17 natural mapping (pp. 302-303).

## Three levels
- **Micro (each input)**: discrete vs continuous; linear vs rotation; position vs force sensitivity; dimensions; **direct vs indirect** (the DS touch screen is direct: you touch the thing; mouse and pad are indirect); boundaries (stick housing, screen edge for the mouse); sensitivity = number of states (button 2, trigger a handful, paddle hundreds, stick/mouse effectively infinite); signal format (boolean up/pressed/down/released, float -1..1, displacement pair per frame) (pp. 103-114, comparison table pp. 114-115).
- **Macro (device as a whole)**: how many inputs are used and how they combine (NES: left+right impossible on a D-pad, possible on keyboard, so the same game feels different); combinations enlarge the input space (pp. 115-117).
- **Tactile**: weight, material, button spring and travel ("sensitivity can come down to millimetres" across cross-platform ports), industrial design; prototypes feel better on a good pad than on keyboard keys (pp. 117-118, 85-86).
- The designer rarely picks the device but always picks which inputs are valid; sensitivity of the input times sensitivity of the response gives "virtual sensitivity" (see [[gamefeel-swink-response-adsr-and-mapping]]).

## Design opinions on input
- Natural mapping (stick direction equals ship direction; WASD, wheel, mouse) makes games easy to learn (pp. 53-54, 302).
- **Natural is not realistic**: making input mimic reality removes the great pleasure of "large response for small input" (megaphone for thumbs). Wiimote sword swipes in Twilight Princess are high input sensitivity mapped to a low-sensitivity canned animation, "the wrong kind of obfuscation"; Wii Bowling works better because release speed and rotation shape the result (pp. 322-324, 331).
- A touch screen collapses the control-display ratio to unity and bridges the gulf of execution, but an unremarkable "kiosk" interface is not fun unless the input is transposed into something rich (p. 322). Direct tap on an avatar gave only an impulse in Kirby Canvas Curse, not a correction loop (pp. 78-80).
- Haptics: rumble is a blunt rotational tool; best when matched to a clear metaphor (gun recoil, grinding), judicious use; force feedback tires wrists and "fights back" (pp. 162, 324-328).
- Players are narrower than the input space: unconventional inputs (lid close, port swap) are delightful when meaningful (pp. 55-56, 331).

## Stance and applicability
- (a) Console pads, keyboard, mouse, motion controller (2009). Touch appears only as a direct-input label; no multitouch, gestures-as-UI, thumb reach or latency discussion.
- (b) Classification plus designer opinion; no usability data.
- (c) Complements, but does not replace, [[mobiledesign-scolastici-touch-input-and-controls]] (touch-specific idioms, button size); agrees with it on "keep inputs simple". Qualifies [[cozydive-bycer-ui-ux-and-approachability]] (approachability): the book says some friction is desirable, Bycer wants less friction in the core loop; resolve by removing interference (misreads) and keeping meaningful skill.
- (d) Fit for a mobile casual match-3 + deco game: **medium**. Direct-input framing, input sensitivity (a drag carries far more information than a tap, so a drag-card mechanic can have richer response curves) and signal-over-time thinking transfer; tactile device material, buttons, rumble and motion-control content do not (phone haptics are a small extra layer).
