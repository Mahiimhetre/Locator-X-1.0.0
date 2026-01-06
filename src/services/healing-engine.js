class HealingEngine {
    constructor() {
        this.weights = {
            id: 30,
            name: 20,
            text: 15,
            class: 15, // Total weight for all class matches
            attributes: 15, // Total weight for other attributes
            context: 5, // Parent/Sibling matching
            tag: 50 // Heavy penalty or required? Let's treat as filter mostly.
        };
        this.threshold = 0.5; // Minimum score ratio to be considered a candidate (50%)
    }

    /**
     * Find the best matching element in the document for the given fingerprint.
     * @param {Object} fingerprint - The element fingerprint to match.
     * @param {HTMLElement} root - The root element to search within (default document).
     * @returns {Object|null} - The best match { element, score, reasons } or null.
     */
    findBestMatch(fingerprint, root = document) {
        if (!fingerprint || !fingerprint.tag) return null;

        // Optimization: Try to stay within the same tag family if possible
        // But for robust healing (e.g. div -> button), we might want to scan more.
        // For now, let's scan all elements if tag lookup fails or finding is low confidence.

        let candidates = Array.from(root.getElementsByTagName(fingerprint.tag));

        // If very few candidates or none, maybe tag changed?
        // Let's also include elements that have matching ID or Name (if unique) just in case tag changed.
        if (fingerprint.id) {
            const idMatch = root.getElementById(fingerprint.id);
            if (idMatch && idMatch.tagName.toLowerCase() !== fingerprint.tag) candidates.push(idMatch);
        }
        if (fingerprint.name) {
            const nameMatches = document.getElementsByName(fingerprint.name);
            candidates.push(...Array.from(nameMatches).filter(el => el.tagName.toLowerCase() !== fingerprint.tag));
        }

        // De-duplicate
        candidates = [...new Set(candidates)];

        // Fallback: If still no good candidates, scan all body elements (Expensive!)
        // Maybe only needed if we are really desperate. Let's stick to tag/id/name for now to avoid freezing page.

        let bestMatch = null;
        let highResult = { score: 0 };

        for (const element of candidates) {
            const result = this.calculateScore(element, fingerprint);
            if (result.score > highResult.score) {
                highResult = { ...result, element };
            }
        }

        if (highResult.score >= 40) { // arbitrary threshold 40/100
            return highResult;
        }

        return null;
    }

    calculateScore(element, fingerprint) {
        let score = 0;
        const reasons = [];
        const maxScore = 100; // Normalized roughly

        // 1. Tag Match (Check first)
        if (element.tagName.toLowerCase() !== fingerprint.tag) {
            // Penalty? Or just 0 points for tag. 
            // If tag is strict, we wouldn't be here (unless we added ID matches).
            // Let's give points for tag match
        } else {
            // Implicitly good, but we don't give "points" per se, just avoid penalty.
            // Actually let's give baseline points.
            score += 10;
            reasons.push('Tag match');
        }

        // 2. ID Match
        if (fingerprint.id && element.id === fingerprint.id) {
            score += this.weights.id;
            reasons.push('ID match');
        }

        // 3. Name Match
        if (fingerprint.name && element.name === fingerprint.name) {
            score += this.weights.name;
            reasons.push('Name match');
        }

        // 4. Class Match
        if (fingerprint.className && element.className) {
            // fingerprint.className is dot-separated string from generator?
            // "btn.btn-primary" -> specific implementation in generator uses dots?
            // Let's check generator again. cleanClassName returns "cls1.cls2"

            const fpClasses = fingerprint.className.split('.').filter(c => c);
            const elClasses = (typeof element.className === 'string' ? element.className : '').split(/\s+/).filter(c => c);

            const intersection = fpClasses.filter(c => elClasses.includes(c));
            if (fpClasses.length > 0) {
                const ratio = intersection.length / fpClasses.length;
                const points = this.weights.class * ratio;
                score += points;
                if (points > 0) reasons.push(`Class match (${Math.round(ratio * 100)}%)`);
            }
        }

        // 5. Text Match
        const elText = (element.textContent || '').substring(0, 50).trim();
        if (fingerprint.text && elText) {
            if (elText === fingerprint.text) {
                score += this.weights.text;
                reasons.push('Exact text match');
            } else if (elText.includes(fingerprint.text) || fingerprint.text.includes(elText)) {
                score += this.weights.text * 0.6;
                reasons.push('Partial text match');
            }
        }

        // 6. Attributes Match
        if (fingerprint.attributes) {
            const attrs = fingerprint.attributes;
            const keys = Object.keys(attrs);
            let matches = 0;
            keys.forEach(k => {
                if (element.getAttribute(k) === attrs[k]) matches++;
            });
            if (keys.length > 0) {
                const ratio = matches / keys.length;
                score += this.weights.attributes * ratio;
                if (matches > 0) reasons.push('Attribute match');
            }
        }

        // 7. Context (Parent)
        if (fingerprint.parentTag && element.parentElement) {
            if (element.parentElement.tagName.toLowerCase() === fingerprint.parentTag) {
                score += this.weights.context / 2;
                // reasons.push('Parent tag match');
            }
        }

        // Return result
        return { score, reasons };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HealingEngine;
} else {
    window.HealingEngine = HealingEngine;
}
