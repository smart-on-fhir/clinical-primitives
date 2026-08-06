/**
 * Curve fitting for observation charts. Pure math, no DOM, so the shape of the
 * line can be reasoned about and tested on its own.
 */

export interface Point {
    x: number,
    y: number
}

/**
 * An SVG path through every point, smoothed with monotone cubic interpolation
 * (Fritsch-Carlson).
 *
 * Deliberately not Catmull-Rom or a plain cardinal spline. Those overshoot
 * between points, which on a lab chart draws values the patient never had — a
 * curve dipping below zero between two low results, or cresting above a peak
 * and implying a maximum that was never measured. Monotone interpolation is
 * guaranteed to stay within the data on each segment: it can never introduce a
 * local extreme that is not in the readings, and a run of equal values renders
 * flat rather than rippling.
 *
 * Points must be sorted by ascending x with no duplicates; the caller owns
 * that, since resolving two readings at one instant is a data question rather
 * than a drawing one.
 */
export function splinePath(points: Point[]): string {
    if (points.length === 0) {
        return "";
    }

    const move = `M ${points[0].x} ${points[0].y}`;

    if (points.length === 1) {
        return move;
    }

    const n = points.length;

    // Secant slopes between consecutive points.
    const secants: number[] = [];

    for (let i = 0; i < n - 1; i++) {
        const h = points[i + 1].x - points[i].x;
        // Coincident or unsorted x would divide by zero or fold the curve back
        // on itself; a zero slope degrades that segment to a straight line
        // rather than producing NaN and losing the whole path.
        secants.push(h > 0 ? (points[i + 1].y - points[i].y) / h : 0);
    }

    // Tangents at each point: the average of the adjacent secants, with the
    // endpoints taking their single neighbouring secant.
    const tangents: number[] = new Array(n);

    tangents[0]     = secants[0];
    tangents[n - 1] = secants[n - 2];

    for (let i = 1; i < n - 1; i++) {
        // Opposite-signed secants mean this reading is a local peak or trough.
        // Its tangent must be flat: averaging them instead leaves the curve
        // still climbing as it arrives, so it sails past the reading before
        // turning back — drawing a maximum higher than anything measured.
        //
        // The Fritsch-Carlson pass below cannot repair this. It only scales
        // tangents down, so a tangent pointing the wrong way stays pointing the
        // wrong way, merely shorter.
        tangents[i] = secants[i - 1] * secants[i] <= 0
            ? 0
            : (secants[i - 1] + secants[i]) / 2;
    }

    // The Fritsch-Carlson correction, which is what makes this monotone. A flat
    // segment pins both its tangents to zero; otherwise the tangent pair is
    // scaled back inside a circle of radius 3 , the condition that guarantees
    // the cubic cannot leave the interval spanned by its endpoints.
    for (let i = 0; i < n - 1; i++) {
        if (secants[i] === 0) {
            tangents[i]     = 0;
            tangents[i + 1] = 0;
            continue;
        }

        const alpha = tangents[i]     / secants[i];
        const beta  = tangents[i + 1] / secants[i];
        const size  = alpha * alpha + beta * beta;

        if (size > 9) {
            const scale = 3 / Math.sqrt(size);
            tangents[i]     = scale * alpha * secants[i];
            tangents[i + 1] = scale * beta  * secants[i];
        }
    }

    // Each Hermite segment becomes a cubic Bezier: the control points sit a
    // third of the segment's width along each endpoint's tangent.
    const segments: string[] = [];

    for (let i = 0; i < n - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const h  = (p1.x - p0.x) / 3;

        segments.push(
            `C ${p0.x + h} ${p0.y + tangents[i] * h}, ` +
            `${p1.x - h} ${p1.y - tangents[i + 1] * h}, ` +
            `${p1.x} ${p1.y}`
        );
    }

    return `${move} ${segments.join(" ")}`;
}
