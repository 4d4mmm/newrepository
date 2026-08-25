import {
  BORDER_SAFE_TAGS,
  EM_DASH_CHARS_PER_DASH,
  EM_DASH_FLOOR,
  GENERIC_FONTS,
  KNOWN_SERIF_FONTS,
  OVERUSED_FONTS,
  SAFE_TAGS,
  WCAG_LARGE_BOLD_TEXT_PX,
  WCAG_LARGE_TEXT_PX,
  isBrandFontOnOwnDomain,
} from '../shared/constants.mjs';
import {
  CSS_NAMED_COLORS,
  colorToHex,
  compositeColorOver,
  contrastRatio,
  getHue,
  hasChroma,
  isNeutralColor,
  isNoPaintColorValue,
  oklchToRgb,
  parseAnyColor,
  parseColorMix,
  parseGradientColors,
  parseRgb,
  relativeLuminance,
  splitTopLevelCommas,
} from '../shared/color.mjs';
import { extractGoogleFontFamilies } from '../shared/fonts.mjs';

const DETECTOR_IS_BROWSER = typeof window !== 'undefined';

// ─── Section 3: Pure Detection ──────────────────────────────────────────────

function checkBorders(tag, widths, colors, radius, opts = {}) {
  // Badge-shaped <span>s (own visible background) are a real stripe target
  // for the top/bottom variant — the inline-tag exemption exists to quiet
  // text-level borders, not chips. They skip the left/right arms below.
  const spanBadge = tag === 'span' && !!opts.badgeLike;
  if (BORDER_SAFE_TAGS.has(tag) && !spanBadge) return [];
  // A live status/alert region wears a colored single-edge border as a
  // severity accent (toast, snackbar, callout), not as the side-tab tell.
  if (opts.statusContext) return [];
  const findings = [];
  const sides = ['Top', 'Right', 'Bottom', 'Left'];

  for (const side of sides) {
    const w = widths[side];
    if (w < 1 || isNeutralColor(colors[side])) continue;

    const otherSides = sides.filter(s => s !== side);
    const maxOther = Math.max(...otherSides.map(s => widths[s]));
    if (!(w >= 2 && (maxOther <= 1 || w >= maxOther * 2))) continue;

    const sn = side.toLowerCase();
    const isSide = side === 'Left' || side === 'Right';

    if (isSide) {
      if (spanBadge) continue;
      if (radius > 0) findings.push({ id: 'side-tab', snippet: `border-${sn}: ${w}px + border-radius: ${radius}px` });
      else if (w >= 3) findings.push({ id: 'side-tab', snippet: `border-${sn}: ${w}px` });
    } else {
      if (radius > 0 && w >= 2) findings.push({ id: 'border-accent-on-rounded', snippet: `border-${sn}: ${w}px + border-radius: ${radius}px` });
      // Horizontal variant of the side-tab stripe: a thick chromatic accent
      // riding the top or bottom edge of a card/badge/container. Same
      // dominant-edge + chroma gates as left/right, 3-12px band. Selected-
      // tab underlines are exempt via opts.tabContext (adapters look for
      // tablist/nav/tab ancestors and aria-selected); links, buttons,
      // table cells, and <hr> never reach here (BORDER_SAFE_TAGS).
      else if (!opts.tabContext && w >= 3 && w <= 12) {
        findings.push({ id: 'side-tab', snippet: `border-${sn}: ${w}px` });
      }
    }
  }

  return findings;
}

// ─── Scoped ignores: data-impeccable-ignore ─────────────────────────────────
//
// An element-scoped waiver that travels with the markup: any element carrying
// `data-impeccable-ignore="rule-a rule-b"` (or `*`, or an empty value, for
// every rule) suppresses matching findings from itself and its entire subtree,
// in every engine that walks elements — the browser overlay, the extension,
// and the static scan. This is the DOM twin of the line-based
// `impeccable-disable` comment directives, which the browser cannot apply (a
// live DOM has no line numbers), and the generalization of the one-off
// `data-impeccable-allow-kickers` opt-out.
//
// The intended use is curated exhibits: a page that documents anti-patterns by
// example, or renders a deliberate "before" specimen, marks the container once
// and every engine skips it while still scanning the page around it.
function scopedIgnoreActive(el, ruleId) {
  const rule = String(ruleId || '').toLowerCase();
  let cur = el;
  while (cur && cur.nodeType === 1) {
    const attr = typeof cur.getAttribute === 'function' ? cur.getAttribute('data-impeccable-ignore') : null;
    if (attr != null) {
      const rules = String(attr).trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (rules.length === 0 || rules.includes('*') || rules.includes(rule)) return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

// Returns true if the given text is composed entirely of emoji characters
// (plus whitespace / variation selectors). Emojis render as multicolor glyphs
// regardless of CSS `color`, so contrast checks against the element's text
// color are meaningless for these nodes.
const EMOJI_CHAR_RE = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/u;
const EMOJI_CHARS_GLOBAL = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;
function isEmojiOnlyText(text) {
  if (!text) return false;
  if (!EMOJI_CHAR_RE.test(text)) return false;
  return text.replace(EMOJI_CHARS_GLOBAL, '').trim() === '';
}

function checkColors(opts) {
  const { tag, textColor, bgColor, effectiveBg, effectiveBgStops, fontSize, fontWeight, hasDirectText, isEmojiOnly, bgClip, bgImage, classList } = opts;
  if (SAFE_TAGS.has(tag)) {
    // Exception for elements styled as controls or chips. SAFE_TAGS exists to
    // suppress contrast noise on inline links and unstyled spans, where the
    // element has no own background and the contrast against the ancestor
    // surface is already the intended visual. When the element paints its own
    // opaque background under direct text, it is a styled button, chip, or
    // badge regardless of tag, and contrast on its own surface is a real,
    // frequent bug worth flagging. (The shipped miss: a <span> severity chip
    // whose white text lost a specificity fight and rendered muted-on-red at
    // 1.2:1; the old a/button-only exception never looked at it.) The 9px
    // font floor keeps sub-text decorations out.
    const isStyledControl = hasDirectText
      && ((bgColor && bgColor.a > 0.5)
        // A gradient painted on the element itself is an own surface the
        // same way a solid background is. Without this branch a nav CTA
        // built as `<a>` with `background: linear-gradient(…)` and a text
        // color that fails against every stop sails through on the
        // SAFE_TAGS suppression (the shipped escape).
        || (bgImage && /gradient/i.test(bgImage)))
      && fontSize >= 9;
    if (!isStyledControl) return [];
  }
  const findings = [];

  if (hasDirectText && textColor && !isEmojiOnly) {
    // Gradient-clipped text (`background-clip: text`, typically with a
    // transparent text-fill) paints its glyphs *with* the element's own
    // gradient. The `color` value the cascade still reports is never painted,
    // and the gradient is the fill, not a backdrop — so measuring `color`
    // against that gradient (which resolveGradientStops picks up as the
    // element's own background-image) is a guaranteed false positive
    // (issue #409 Case A). Skip the backdrop-contrast checks; the gradient-text
    // rule below still flags the pattern itself. Skipping a rule beats a false
    // positive here — the true painted contrast can't be measured from `color`.
    const isGradientClippedText = bgClip === 'text';
    // Run background-dependent checks against either a solid bg or, if the
    // ancestor is a gradient, against every gradient stop (use the worst case).
    const bgs = isGradientClippedText
      ? null
      : (effectiveBg ? [effectiveBg] : (effectiveBgStops && effectiveBgStops.length ? effectiveBgStops : null));
    if (bgs) {
      // Gray on colored background — flag if every stop is chromatic
      const textLum = relativeLuminance(textColor);
      const isGray = !hasChroma(textColor, 20) && textLum > 0.05 && textLum < 0.85;
      if (isGray && bgs.every(b => hasChroma(b, 40))) {
        const bgLabel = effectiveBg ? colorToHex(effectiveBg) : `gradient(${bgs.map(colorToHex).join(', ')})`;
        findings.push({ id: 'gray-on-color', snippet: `text ${colorToHex(textColor)} on bg ${bgLabel}` });
      }

      // Low contrast (WCAG AA) — worst case across all bg stops
      const ratios = bgs.map(b => contrastRatio(textColor, b));
      let worstIdx = 0;
      for (let i = 1; i < ratios.length; i++) if (ratios[i] < ratios[worstIdx]) worstIdx = i;
      const ratio = ratios[worstIdx];
      const isLargeText = fontSize >= WCAG_LARGE_TEXT_PX || (fontSize >= WCAG_LARGE_BOLD_TEXT_PX && fontWeight >= 700);
      const threshold = isLargeText ? 3.0 : 4.5;
      if (ratio < threshold) {
        // Skip the false-positive class where text has alpha < 1 AND we
        // couldn't find an opaque ancestor (effectiveBg is null, we're
        // comparing against gradient-stop fallback). In jsdom mode the
        // detector can't resolve `var(--X)` color tokens, so a dark
        // section sitting between the text and the body's decorative
        // gradient is invisible to us — we end up measuring contrast
        // against the body's paper-grain noise instead of the real
        // local bg. Real low-contrast bugs use alpha=1 and have a
        // resolvable opaque ancestor; semi-transparent Tailwind tokens
        // like `text-paper/60` on `bg-ink` sections are the FP pattern.
        const isAlphaFallbackFP = !DETECTOR_IS_BROWSER && !effectiveBg && (textColor.a != null && textColor.a < 1);
        if (!isAlphaFallbackFP) {
          // Near-threshold ratios (e.g. 4.497) would round to the threshold
          // itself at one decimal and read as "4.5 needs 4.5" — show two
          // decimals there so the finding stays legible.
          const ratioLabel = ratio.toFixed(1) === threshold.toFixed(1) ? ratio.toFixed(2) : ratio.toFixed(1);
          findings.push({ id: 'low-contrast', snippet: `${ratioLabel}:1 (need ${threshold}:1) — text ${colorToHex(textColor)} on ${colorToHex(bgs[worstIdx])}` });
        }
      }
    }

    // AI palette: purple/violet on headings
    if (hasChroma(textColor, 50)) {
      const hue = getHue(textColor);
      if (hue >= 260 && hue <= 310 && (['h1', 'h2', 'h3'].includes(tag) || fontSize >= 20)) {
        findings.push({ id: 'ai-color-palette', snippet: `Purple/violet text (${colorToHex(textColor)}) on heading` });
      }
    }
  }

  // Gradient text
  if (bgClip === 'text' && bgImage && bgImage.includes('gradient')) {
    findings.push({ id: 'gradient-text', snippet: 'background-clip: text + gradient' });
  }

  // Tailwind class checks
  if (classList) {
    const classStr = typeof classList === 'string' ? classList : Array.from(classList).join(' ');

    const grayMatch = classStr.match(/\btext-(?:gray|slate|zinc|neutral|stone)-\d+\b/);
    const colorBgMatch = classStr.match(/\bbg-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/);
    if (grayMatch && colorBgMatch) {
      findings.push({ id: 'gray-on-color', snippet: `${grayMatch[0]} on ${colorBgMatch[0]}` });
    }

    if (/\bbg-clip-text\b/.test(classStr) && /\bbg-gradient-to-/.test(classStr)) {
      findings.push({ id: 'gradient-text', snippet: 'bg-clip-text + bg-gradient (Tailwind)' });
    }

    const purpleText = classStr.match(/\btext-(?:purple|violet|indigo)-\d+\b/);
    if (purpleText && (['h1', 'h2', 'h3'].includes(tag) || /\btext-(?:[2-9]xl)\b/.test(classStr))) {
      findings.push({ id: 'ai-color-palette', snippet: `${purpleText[0]} on heading` });
    }

    if (/\bfrom-(?:purple|violet|indigo)-\d+\b/.test(classStr) && /\bto-(?:purple|violet|indigo|blue|cyan|pink|fuchsia)-\d+\b/.test(classStr)) {
      findings.push({ id: 'ai-color-palette', snippet: 'Purple/violet gradient (Tailwind)' });
    }
  }

  return findings;
}

// WCAG contrast for the :hover state of an element whose hover rules change
// its text color and/or background. The classic miss: a nav CTA whose
// author-intended hover pair passes AA, but a broader selector (e.g.
// `.nav-links a:hover`) wins the specificity fight and swaps in a color
// that fails. Only fires on elements that present as styled controls —
// direct text plus an opaque-ish own background in either state — so plain
// inline links keep the same suppression they get in checkColors.
function checkHoverContrast(opts) {
  const { tag, textColor, bg, ownBgAlpha, fontSize, fontWeight, hasDirectText, isEmojiOnly } = opts;
  if (!hasDirectText || isEmojiOnly || !textColor || !bg) return [];
  if (SAFE_TAGS.has(tag) && !(ownBgAlpha != null && ownBgAlpha > 0.5)) return [];
  const ratio = contrastRatio(textColor, bg);
  const isLargeText = fontSize >= WCAG_LARGE_TEXT_PX || (fontSize >= WCAG_LARGE_BOLD_TEXT_PX && fontWeight >= 700);
  const threshold = isLargeText ? 3.0 : 4.5;
  if (ratio >= threshold) return [];
  return [{
    id: 'low-contrast',
    snippet: `:hover state ${ratio.toFixed(1)}:1 (need ${threshold}:1) — text ${colorToHex(textColor)} on ${colorToHex(bg)}`,
  }];
}

function isCardLikeFromProps(hasShadow, hasBorder, hasRadius, hasBg) {
  if (!hasShadow && !hasBorder) return false;
  return hasRadius || hasBg;
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// Pure check: given a heading and metrics about its previousElementSibling,
// decide if the sibling is the canonical "icon-tile-stacked-above-heading" shape.
//
// Triggers when ALL of the following hold for the sibling:
//   • size 32–128px on both axes (not too small, not a hero image)
//   • aspect ratio 0.7–1.4 (squarish — excludes wide thumbnails / pill badges)
//   • has a non-transparent background-color, background-image, OR a visible border
//     (covers solid colors, white-with-border, gradients — anything that visually
//      defines a tile)
//   • border-radius < width/2 (excludes round avatars; rounded squares pass)
//   • contains an <svg> or icon-class <i> element that's smaller than the tile
//   • the tile sits above the heading (its bottom is above the heading's top)
function checkIconTile(opts) {
  const { headingTag, headingText, headingTop,
          siblingTag, siblingWidth, siblingHeight, siblingBottom,
          siblingBgColor, siblingBgImage, siblingBorderWidth, siblingBorderRadius,
          hasIconChild, iconChildWidth } = opts;
  if (!HEADING_TAGS.has(headingTag)) return [];
  if (!siblingTag) return [];
  // Don't recurse into nested headings (e.g. h2 above h3 in a section header)
  if (HEADING_TAGS.has(siblingTag)) return [];

  // Size window: 32–128px on each axis
  if (!(siblingWidth >= 32 && siblingWidth <= 128)) return [];
  if (!(siblingHeight >= 32 && siblingHeight <= 128)) return [];

  // Squarish aspect ratio
  const ratio = siblingWidth / siblingHeight;
  if (ratio < 0.7 || ratio > 1.4) return [];

  // Must have something that visually defines the tile
  const bgVisible = (siblingBgColor && siblingBgColor.a > 0.1)
    || (siblingBgImage && siblingBgImage !== 'none' && siblingBgImage !== '');
  const borderVisible = siblingBorderWidth > 0;
  if (!bgVisible && !borderVisible) return [];

  // Exclude circles (avatars). Rounded squares pass.
  if (siblingBorderRadius >= siblingWidth / 2) return [];

  // Must contain an icon element smaller than the tile
  if (!hasIconChild) return [];
  if (iconChildWidth && iconChildWidth >= siblingWidth * 0.95) return [];

  // Vertical stacking: tile must end above where the heading starts.
  // (Allow the check to skip when both top/bottom are 0 — jsdom layout case.)
  if (headingTop && siblingBottom && siblingBottom > headingTop + 4) return [];

  const text = (headingText || '').trim().slice(0, 60);
  return [{
    id: 'icon-tile-stack',
    snippet: `${Math.round(siblingWidth)}x${Math.round(siblingHeight)}px icon tile above ${headingTag} "${text}"`,
  }];
}

// Resolve the primary (non-generic) face from a font-family string and return
// whether the resolved primary is serif. Two paths:
//   1. Primary face is in KNOWN_SERIF_FONTS → serif.
//   2. Primary face is unknown but the stack ends in the generic `serif`
//      token → treat as serif. Authors who declare `font-family: 'X', serif`
//      almost always have a serif primary; a sans declared with a serif
//      fallback is a code smell, not the common case.
// Returns { primary, isSerif } so the snippet can name the face.
function resolveSerif(fontFamily) {
  if (!fontFamily) return { primary: null, isSerif: false };
  const tokens = fontFamily.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  const primary = tokens.find(f => f && !GENERIC_FONTS.has(f)) || null;
  if (!primary) return { primary: null, isSerif: false };
  if (KNOWN_SERIF_FONTS.has(primary)) return { primary, isSerif: true };
  if (tokens.includes('serif')) return { primary, isSerif: true };
  return { primary, isSerif: false };
}

function checkItalicSerif(opts) {
  const { tag, fontStyle, fontFamily, fontSize, headingText } = opts;
  if (fontStyle !== 'italic') return [];
  // Anchor the rule on hero-scale text. h1 is the canonical hero element;
  // h2 ≥ 48px catches the cases where the design demotes the visual hero
  // to an h2 but keeps the size.
  if (tag !== 'h1' && !(tag === 'h2' && fontSize >= 48)) return [];
  if (fontSize < 48) return [];
  const { primary, isSerif } = resolveSerif(fontFamily);
  if (!isSerif) return [];

  const text = (headingText || '').trim().slice(0, 60);
  return [{
    id: 'italic-serif-display',
    snippet: `italic serif ${tag} (${primary || 'serif'}) at ${Math.round(fontSize)}px "${text}"`,
  }];
}

// Color saturation check. Returns true when the color has visible
// chroma — i.e., it's an "accent color" rather than near-neutral.
// Handles rgb()/rgba(), #hex, oklch(), and hsl(). var() refs are
// expected to be pre-resolved by the caller.
function isAccentColor(cssColor) {
  if (!cssColor) return false;
  const s = String(cssColor).trim();
  // rgb / rgba — direct channel-distance check.
  const rgbM = /rgba?\(\s*(\d+)\s*,?\s+|\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s.replace(/rgba?\(\s*/, 'rgb(').replace(/,/g, ', '));
  const rgbStrict = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (rgbStrict) {
    const r = +rgbStrict[1], g = +rgbStrict[2], b = +rgbStrict[3];
    return (Math.max(r, g, b) - Math.min(r, g, b)) >= 40;
  }
  // #hex — 3, 4, 6, or 8 digit.
  const hexM = /^#([0-9a-f]{3,8})\b/i.exec(s);
  if (hexM) {
    let h = hexM[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('').slice(0, 6);
    else h = h.slice(0, 6);
    if (h.length === 6) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return (Math.max(r, g, b) - Math.min(r, g, b)) >= 40;
    }
  }
  // oklch(L C H) — chroma C is what matters. Typical neutral grays
  // have C < 0.02; visible accents are 0.05+. CSS minification can
  // collapse spaces between L% and C ("oklch(43%.15 34)"), so we
  // extract all numbers and take the second rather than matching a
  // strict L-then-whitespace-then-C pattern.
  if (/^oklch\(/i.test(s)) {
    const nums = s.match(/\d*\.\d+|\d+/g);
    if (nums && nums.length >= 2) {
      const c = parseFloat(nums[1]);
      return !Number.isNaN(c) && c >= 0.05;
    }
  }
  // hsl(H, S%, L%) — saturation > 20% reads as accent.
  const hslM = /hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%/i.exec(s);
  if (hslM) {
    const sat = parseFloat(hslM[1]);
    return !Number.isNaN(sat) && sat >= 20;
  }
  return false;
}

function resolveHeroHeadingSizePx(value) {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return 0;

  const simpleLengthPx = (token) => {
    const match = /^(-?\d*\.?\d+)\s*(px|rem|em|%)?$/.exec(String(token || '').trim());
    if (!match) return null;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return null;
    if (match[2] === 'rem' || match[2] === 'em') return amount * 16;
    if (match[2] === '%') return amount * 0.16;
    return amount;
  };

  const direct = simpleLengthPx(input);
  if (direct !== null) return direct;

  // Static CSS engines cannot resolve viewport units, but clamp's min/max
  // bounds still tell us whether the heading can ever reach hero scale.
  const clamp = /^clamp\((.*)\)$/.exec(input);
  if (clamp) {
    const parts = clamp[1].split(',');
    if (parts.length === 3) {
      const bounds = [simpleLengthPx(parts[0]), simpleLengthPx(parts[2])]
        .filter((candidate) => candidate !== null);
      if (bounds.length > 0) return Math.max(...bounds);
    }
  }

  return 0;
}

// Sibling-relationship rule. Anchor on a hero-scale h1, look at the
// previousElementSibling, and gate on EITHER the classic tracked-
// uppercase eyebrow OR the modern accent-colored bold eyebrow.
function checkHeroEyebrow(opts) {
  const {
    headingTag, headingText, headingFontSize,
    headingInApplicationContext,
    siblingTag, siblingText, siblingTextTransform,
    siblingFontSize, siblingLetterSpacing,
    siblingFontWeight, siblingColor,
    siblingHasAccentDashPseudo,
  } = opts;
  if (headingTag !== 'h1') return [];
  // This is specifically a marketing-hero cliché, not a ban on compact
  // context labels in product UI (for example, a station name inside a tab
  // panel). Browser-computed sizes are reliable; the static adapter also
  // resolves ordinary px/rem/em and clamp() bounds before reaching here.
  if (headingInApplicationContext) return [];
  if (!(headingFontSize >= 48)) return [];
  if (!siblingTag) return [];
  // An h2 above an h1 is a different anti-pattern (heading hierarchy / dual
  // headings) — never an eyebrow.
  if (HEADING_TAGS.has(siblingTag)) return [];

  const text = (siblingText || '').trim();
  if (text.length < 2 || text.length > 60) return [];
  if (!(siblingFontSize > 0 && siblingFontSize <= 14)) return [];

  // Branch A: classic tracked-uppercase eyebrow.
  const isUppercased = siblingTextTransform === 'uppercase'
    || (/[A-Z]/.test(text) && !/[a-z]/.test(text));
  const isClassicTracked = isUppercased && siblingLetterSpacing >= 1.6;

  // Branch B: modern accent-bold eyebrow — sentence case, low
  // tracking, but bold + accent-colored. The style choices changed;
  // the pattern is the same kicker-above-headline anti-pattern.
  const weight = Number(siblingFontWeight) || 400;
  const isAccentBold = weight >= 700 && isAccentColor(siblingColor || '');

  // Branch C: dash-prefix eyebrow — sentence case, low tracking, regular
  // weight, but announced by a short chromatic ::before/::after bar
  // (the kicker dash). Same label-above-headline pattern, third styling.
  const isDashPrefixed = !!siblingHasAccentDashPseudo;

  if (!isClassicTracked && !isAccentBold && !isDashPrefixed) return [];

  const headingTextSnippet = (headingText || '').trim().slice(0, 60);
  const eyebrowSnippet = text.slice(0, 40);
  const style = isClassicTracked ? 'tracked-caps' : isAccentBold ? 'accent-bold' : 'dash-prefix';
  return [{
    id: 'hero-eyebrow-chip',
    snippet: `eyebrow chip (${style}) "${eyebrowSnippet}" above ${headingTag} "${headingTextSnippet}"`,
  }];
}

// Outright ban: one kicker is one too many, so every collected candidate is
// a finding. The judgment lives in the candidate gate (isKickerCandidate) and
// the collector's context skips, not in a repetition count.
function checkKickerAboveHeading(opts) {
  const { candidates } = opts;
  if (!Array.isArray(candidates)) return [];
  return candidates.map(candidate => ({
    id: 'kicker-above-heading',
    snippet: `kicker "${candidate.kickerText}" above ${candidate.headingTag} "${candidate.headingText}"`,
  }));
}

const LAYOUT_TRANSITION_PROPS = new Set([
  'width', 'height', 'padding', 'margin',
  'max-height', 'max-width', 'min-height', 'min-width',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
]);

function checkMotion(opts) {
  const { tag, transitionProperty, animationName, timingFunctions, classList } = opts;
  if (SAFE_TAGS.has(tag)) return [];
  const findings = [];

  // --- Bounce/elastic easing ---
  if (animationName && animationName !== 'none' && /bounce|elastic|wobble|jiggle|spring/i.test(animationName)) {
    findings.push({ id: 'bounce-easing', snippet: `animation: ${animationName}` });
  }
  if (classList && /\banimate-bounce\b/.test(classList)) {
    findings.push({ id: 'bounce-easing', snippet: 'animate-bounce (Tailwind)' });
  }

  // Check timing functions for overshoot cubic-bezier (y values outside [0, 1])
  if (timingFunctions) {
    const bezierRe = /cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/g;
    let m;
    while ((m = bezierRe.exec(timingFunctions)) !== null) {
      const y1 = parseFloat(m[2]), y2 = parseFloat(m[4]);
      if (y1 < -0.1 || y1 > 1.1 || y2 < -0.1 || y2 > 1.1) {
        findings.push({ id: 'bounce-easing', snippet: `cubic-bezier(${m[1]}, ${m[2]}, ${m[3]}, ${m[4]})` });
        break;
      }
    }
  }

  // --- Layout property transition ---
  if (transitionProperty && transitionProperty !== 'all' && transitionProperty !== 'none') {
    const props = transitionProperty.split(',').map(p => p.trim().toLowerCase());
    const layoutFound = props.filter(p => LAYOUT_TRANSITION_PROPS.has(p));
    if (layoutFound.length > 0) {
      findings.push({ id: 'layout-transition', snippet: `transition: ${layoutFound.join(', ')}` });
    }
  }

  return findings;
}

// Locate the color token in a single shadow layer. Returns
// { color, start, end } where color is the parsed {r,g,b,a} (null when the
// token exists but can't be parsed — e.g. an unresolved var() or an exotic
// color space), or null when no color token is present at all. Handles both
// serialization orders: computed style puts the color first
// ("rgb(…) 0px 0px 20px"), authored CSS usually puts it last
// ("0 0 20px #3b82f6").
function findShadowColor(layer) {
  const fn = layer.match(/(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab|color)\([^)]*\)/i);
  if (fn) return { color: parseAnyColor(fn[0]), start: fn.index, end: fn.index + fn[0].length };
  const hex = layer.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) return { color: parseAnyColor(hex[0]), start: hex.index, end: hex.index + hex[0].length };
  const wordRe = /[a-zA-Z][a-zA-Z]*/g;
  let m;
  while ((m = wordRe.exec(layer)) !== null) {
    const named = CSS_NAMED_COLORS[m[0].toLowerCase()];
    if (named) return { color: { ...named, a: 1 }, start: m.index, end: m.index + m[0].length };
  }
  return null;
}

// Extract the length values of a shadow layer in declaration order, with the
// color token removed so its components aren't misread as lengths. Handles
// computed-style px values AND authored unitless zeros ("0 0 20px"); rem/em
// approximate at 16px. Result order is offset-x, offset-y, blur, [spread].
function extractShadowLengths(layer, colorStart, colorEnd) {
  const stripped = colorStart != null
    ? layer.slice(0, colorStart) + ' ' + layer.slice(colorEnd)
    : layer;
  const vals = [];
  const re = /(-?\d*\.?\d+)(px|rem|em)?/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    let v = parseFloat(m[1]);
    if (m[2] === 'rem' || m[2] === 'em') v *= 16;
    vals.push(v);
  }
  return vals;
}

function checkGlow(opts) {
  const { boxShadow, textShadow, effectiveBg } = opts;
  const onDarkBg = effectiveBg ? relativeLuminance(effectiveBg) < 0.1 : false;

  // Scan one shadow list. Two glow tells, in any color format:
  //  1. Zero-offset chromatic halo (0 0 Npx <color>) — slop on ANY
  //     background; the light radiates evenly outward, which is never how
  //     real elevation shadows behave. Achromatic zero-offset shadows stay
  //     legal (soft ambient elevation), as do focus rings (blur 0).
  //  2. Any chromatic shadow with real blur on a dark background — the
  //     classic dark-mode glow accent.
  const scan = (value, prop) => {
    if (!value || value === 'none') return null;
    // Split multiple shadows (commas not inside parentheses)
    for (const layer of value.split(/,(?![^(]*\))/)) {
      const colorInfo = findShadowColor(layer);
      // No color token, or one we can't resolve (unresolved var(), exotic
      // color space): don't guess — skip rather than false-positive.
      if (!colorInfo || !colorInfo.color) continue;
      const color = colorInfo.color;
      if (!hasChroma(color, 30)) continue;
      const vals = extractShadowLengths(layer, colorInfo.start, colorInfo.end);
      // Third value is blur (offset-x, offset-y, blur, [spread])
      if (vals.length < 3 || vals[2] <= 4) continue;
      if (vals[0] === 0 && vals[1] === 0) {
        return { id: 'dark-glow', snippet: `Zero-offset ${prop} glow (${colorToHex(color)})` };
      }
      if (onDarkBg) {
        return { id: 'dark-glow', snippet: `Colored ${prop} glow (${colorToHex(color)}) on dark background` };
      }
    }
    return null;
  };

  const found = scan(boxShadow, 'box-shadow') || scan(textShadow, 'text-shadow');
  return found ? [found] : [];
}

// Collect CSS custom property declarations from raw stylesheet/HTML text.
// First declaration wins (:root declarations usually come first); good
// enough for the single-level var() resolution the text engines need.
function collectCssCustomProps(content) {
  const map = new Map();
  const re = /(--.+?)\s*:\s*([^;{}]+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (!map.has(m[1])) map.set(m[1], m[2].trim());
  }
  return map;
}

// Text-level glow scan shared by the regex engine and the page-level HTML
// pattern pass. Resolves single-level var() refs against custom properties
// collected from the same text, then applies the same two glow tells as
// checkGlow: zero-offset chromatic halo (any background) and chromatic
// blurred shadow when the page has a dark background. Returns
// [{ index, snippet }] — index is the offset of the shadow declaration.
// Dark-page heuristic for raw CSS/HTML text: dark hex/rgb literals, Tailwind
// dark bg utilities, or a ROOT-scoped (body/html/:root or <body style>)
// background that resolves — via var() — to a dark color. The var/modern-
// color extension is deliberately root-scoped: a light page with one dark
// accent chip must not turn every tinted drop shadow into a "dark page"
// signal. Shared by the glow and radial-halo text scanners.
function cssTextHasDarkRootBg(content, customProps) {
  const darkBgRe = /background(?:-color)?\s*:\s*(?:#(?:0[0-9a-f]|1[0-9a-f]|2[0-3])[0-9a-f]{4}\b|#(?:0|1)[0-9a-f]{2}\b|rgb\(\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\))/i;
  const twDarkBg = /\bbg-(?:gray|slate|zinc|neutral|stone)-(?:9\d{2}|800)\b/;
  if (darkBgRe.test(content) || twDarkBg.test(content)) return true;
  const rootScopes = [];
  const blockRe = /(?:^|[}\s,;>])(?:body|html|:root)\s*(?:,[^{]*)?\{([^}]*)\}/gi;
  let sm;
  while ((sm = blockRe.exec(content)) !== null) rootScopes.push(sm[1]);
  const inlineBody = content.match(/<body[^>]*\bstyle\s*=\s*"([^"]*)"/i);
  if (inlineBody) rootScopes.push(inlineBody[1]);
  for (const scope of rootScopes) {
    const bgRe = /background(?:-color)?\s*:\s*([^;{}]+)/gi;
    let bm;
    while ((bm = bgRe.exec(scope)) !== null) {
      const c = parseAnyColor(resolveVarRefs(bm[1].trim(), customProps));
      if (c && (c.a ?? 1) > 0.5 && relativeLuminance(c) < 0.1) return true;
    }
  }
  return false;
}

// Best-effort extraction of the CSS selector whose declaration block contains
// the given index in raw CSS text. Lets CSS-text findings carry a live-DOM
// anchor, so the browser pass can resolve scoped ignores against the actual
// element and drop patterns that render nowhere on the page. Returns null for
// @-rule preludes, keyframe steps, nested blocks, and anything that does not
// read as a selector; those findings stay page-level.
function enclosingCssSelector(cssText, index) {
  if (!cssText || !Number.isFinite(index)) return null;
  const open = cssText.lastIndexOf('{', index);
  if (open === -1) return null;
  const prevClose = Math.max(cssText.lastIndexOf('}', open - 1), cssText.lastIndexOf(';', open - 1));
  const raw = cssText.slice(prevClose + 1, open).trim().replace(/\s+/g, ' ');
  if (!raw || raw.startsWith('@') || /^\d/.test(raw) || /[{}<]/.test(raw)) return null;
  // Keyframe steps: percentage steps fail the digit test above, but `from`
  // and `to` would read as (never-matching) type selectors and get a valid
  // finding wrongly dropped by the zero-match rule downstream.
  if (/^(?:from|to)(?:\s*,\s*(?:from|to))*$/i.test(raw)) return null;
  return raw;
}

function scanCssTextForGlow(content) {
  const customProps = collectCssCustomProps(content);
  const hasDarkBg = cssTextHasDarkRootBg(content, customProps);

  const results = [];
  const shadowRe = /\b(box-shadow|text-shadow)\s*:\s*([^;{}]+)/gi;
  let m;
  while ((m = shadowRe.exec(content)) !== null) {
    const prop = m[1].toLowerCase();
    const value = resolveVarRefs(m[2].trim(), customProps);
    for (const layer of value.split(/,(?![^(]*\))/)) {
      const colorInfo = findShadowColor(layer);
      if (!colorInfo || !colorInfo.color || !hasChroma(colorInfo.color, 30)) continue;
      const vals = extractShadowLengths(layer, colorInfo.start, colorInfo.end);
      if (vals.length < 3 || vals[2] <= 4) continue;
      const zeroOffset = vals[0] === 0 && vals[1] === 0;
      if (!zeroOffset && !hasDarkBg) continue;
      results.push({
        index: m.index,
        snippet: zeroOffset
          ? `Zero-offset ${prop} glow (${colorToHex(colorInfo.color)})`
          : `Colored ${prop} glow (${colorToHex(colorInfo.color)}) on dark page`,
      });
      break; // one finding per declaration
    }
  }
  return results;
}
