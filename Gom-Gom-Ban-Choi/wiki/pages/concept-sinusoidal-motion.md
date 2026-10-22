# Sinusoidal motion (sine/cosine for oscillation)

Source: [[src-enfield-mathematics-of-game-development]], ch. 7 (pp. 165–186).

- **Meaning of sin/cos on a vector at angle θ**: sin θ = fraction of the vector in the vertical direction; cos θ = fraction in the horizontal direction (projection onto the axes; 3-4-5 triangle: 60% vertical, 80% horizontal). Signs by quadrant: I (+,+), II cos −/sin +, III (−,−), IV cos +/sin −. Values stay within −1…1. Special triangles: 3-4-5, 30-60-90 (sides 1:√3:2), 45-45-90 (1:1:√2). Values: sin30°=0.5, cos30°=0.866, sin/cos45°=0.707, sin60°=0.866.
- Both waves are **periodic** with period 2π; same value every full turn.
- **General sinusoid**: y = A·sin(B(x + C)) + D (same for cos).
  - amplitude |A| (negative A flips the wave);
  - period = 2π / |B| (B>1 compresses, B<1 stretches);
  - phase shift = −C (C positive shifts left);
  - vertical shift D (the median).
  - Fitting a curve: period 12 → B = π/6; amplitude 2, median 4 → y = 2·sin(π/6·(x+2)) + 4. Check on a graphing calculator.
- **Why use it in games**: oscillation between two values *with easing*, slowing near the ends and speeding in the middle, unlike a linear back-and-forth. Examples: patrolling platform, throbbing light intensity, **head bob** while walking.
- **Head bob activity**: vertical offset = amplitude × sin(frequency × time). Amplitude (how far the head moves) doesn't change the period (how often footsteps fall). Play a footstep sound at the moment the sine changes direction (lowest point).
- Exercise: a platform moving ±3 units every 2 s → x = x₀ + 3·sin(π·t) (period 2 s means B = π).

Related: [[concept-trigonometry-and-angles]], [[concept-projection-and-reflection]].
