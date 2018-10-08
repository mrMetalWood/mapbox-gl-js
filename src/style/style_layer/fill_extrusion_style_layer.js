// @flow

import StyleLayer from '../style_layer';

import FillExtrusionBucket from '../../data/bucket/fill_extrusion_bucket';
import { multiPolygonIntersectsMultiPolygon } from '../../util/intersection_tests';
import { translateDistance, translate } from '../query_utils';
import properties from './fill_extrusion_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';
import {vec4} from 'gl-matrix';
import {mat4} from 'gl-matrix';
import Point from '@mapbox/point-geometry';

import type { FeatureState } from '../../style-spec/expression';
import type {BucketParameters} from '../../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {PaintProps} from './fill_extrusion_style_layer_properties';
import type Framebuffer from '../../gl/framebuffer';
import type Transform from '../../geo/transform';
import type {LayerSpecification} from '../../style-spec/types';

class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    viewportFrame: ?Framebuffer;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
    }

    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>) {
        return new FillExtrusionBucket(parameters);
    }

    queryRadius(): number {
        return translateDistance(this.paint.get('fill-extrusion-translate'));
    }

    queryIntersectsFeature(queryGeometry: Array<Array<Point>>,
                           feature: VectorTileFeature,
                           featureState: FeatureState,
                           geometry: Array<Array<Point>>,
                           zoom: number,
                           transform: Transform,
                           pixelsToTileUnits: number,
                           posMatrix: Float32Array): boolean {

        const translatedPolygon = queryGeometry;
        /*
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-extrusion-translate'),
            this.paint.get('fill-extrusion-translate-anchor'),
            transform.angle, pixelsToTileUnits);
            */

        const height = this.paint.get('fill-extrusion-height').evaluate(feature);
        const base = this.paint.get('fill-extrusion-base').evaluate(feature);
        //if (base + height < 100) return true;
        //return false;

        const projectedQueryGeometry = projectQueryGeometry(translatedPolygon, posMatrix, transform, 0);

        const projected = projectExtrusion(geometry, base, height, posMatrix);
        const projectedBase = projected[0];
        const projectedTop = projected[1];
        //const projectedTop = projectQueryGeometry(geometry, posMatrix, transform, height);
        //const projectedBase = projectQueryGeometry(geometry, posMatrix, transform, base);
        return checkIntersection(projectedBase, projectedTop, projectedQueryGeometry);
    }

    hasOffscreenPass() {
        return this.paint.get('fill-extrusion-opacity') !== 0 && this.visibility !== 'none';
    }

    resize() {
        if (this.viewportFrame) {
            this.viewportFrame.destroy();
            this.viewportFrame = null;
        }
    }
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function getIntersectionDistance(projectedQueryGeometry, projectedFace) {

    if (projectedQueryGeometry.length === 1 && projectedQueryGeometry[0].length === 1) {
        // For point queries calculate the z at which the point intersects the face
        // using barycentric coordinates.
        const a = projectedFace[0];
        const b = projectedFace[1];
        const c = projectedFace[3];
        const p = projectedQueryGeometry[0][0];
        
        const ab = b.sub(a);
        const ac = c.sub(a);
        const ap = p.sub(a);

        const dotABAB = dot(ab, ab);
        const dotABAC = dot(ab, ac);
        const dotACAC = dot(ac, ac);
        const dotAPAB = dot(ap, ab);
        const dotAPAC = dot(ap, ac);
        const denom = dotABAB * dotACAC - dotABAC * dotABAC;
        const v = (dotACAC * dotAPAB - dotABAC * dotAPAC) / denom;
        const w = (dotABAB * dotAPAC - dotABAC * dotAPAB) / denom;
        const u = 1 - v - w;

        return a.z * u + b.z * v + c.z * w;

    } else {
        // The counts as closest is less clear when the query is a box. This
        // returns the distance to the nearest point on the face, whether it is
        // within the query or not. It could be more correct to return the
        // distance to the closest point within the query box but this would be
        // more complicated and expensive to calculate with little benefit.
        let closestDistance = Infinity;
        for (const p of projectedFace) {
            closestDistance = Math.min(closestDistance, p.z);
        }
        return closestDistance;
    }
}

function checkIntersection(projectedBase, projectedTop, projectedQueryGeometry) {
    let closestDistance = Infinity;

    if (multiPolygonIntersectsMultiPolygon(projectedQueryGeometry, projectedTop)) {
        closestDistance = getIntersectionDistance(projectedQueryGeometry, projectedTop[0]);
    }

    for (let r = 0; r < projectedTop.length; r++) {
        const ringTop = projectedTop[r];
        const ringBase = projectedBase[r];
        for (let p = 0; p < ringTop.length - 1; p++) {
            const topA = ringTop[p];
            const topB = ringTop[p + 1];
            const baseA = ringBase[p];
            const baseB = ringBase[p + 1];
            const face = [topA, topB, baseB, baseA, topA];
            if (multiPolygonIntersectsMultiPolygon(projectedQueryGeometry, [face])) {
                closestDistance = Math.min(closestDistance, getIntersectionDistance(projectedQueryGeometry, face));
            }
        }
    }

    return closestDistance === Infinity ? false : closestDistance;
}

function projectExtrusion(geometry, zBase, zTop, m) {
    const projectedBase = [];
    const projectedTop = [];
    for (const r of geometry) {
        const ringBase = [];
        const ringTop = [];
        for (const p of r) {
            const x = p.x;
            const y = p.y;
            const w = 1;

            const baseX = m[0] * x + m[4] * y + m[8] * zBase + m[12] * w;
            const baseY = m[1] * x + m[5] * y + m[9] * zBase + m[13] * w;
            const baseZ = m[2] * x + m[6] * y + m[10] * zBase + m[14] * w;
            const baseW = m[3] * x + m[7] * y + m[11] * zBase + m[15] * w;

            const topX = m[0] * x + m[4] * y + m[8] * zTop + m[12] * w;
            const topY = m[1] * x + m[5] * y + m[9] * zTop + m[13] * w;
            const topZ = m[2] * x + m[6] * y + m[10] * zTop + m[14] * w;
            const topW = m[3] * x + m[7] * y + m[11] * zTop + m[15] * w;

            ringBase.push(new Point(baseX / baseW, baseY / baseW));
            ringBase[ringBase.length - 1].z = baseZ / baseW;
            ringTop.push(new Point(topX / topW, topY / topW));
            ringTop[ringTop.length - 1].z = topZ / topW;
        }
        projectedBase.push(ringBase);
        projectedTop.push(ringTop);
    }
    return [projectedBase, projectedTop];
}

function projectPoint(p: Point, posMatrix: Float32Array, transform: Transform, z: number) {
    //const t = mat4.identity([]);
    //mat4.translate(t, t, [1, 1, 0]);
    //mat4.scale(t, t, [transform.width * 0.5, transform.height * 0.5, 1]);
    //const matrix = mat4.multiply(t, t, posMatrix);
    const point = vec4.transformMat4([], [p.x, p.y, z, 1], posMatrix);
    return new Point(
            (point[0] / point[3] + 0),// * transform.width * 0.5,
            (point[1] / point[3] + 0));// * transform.height * 0.5);
}

function projectQueryGeometry(queryGeometry: Array<Array<Point>>, posMatrix: Float32Array, transform: Transform, z: number) {
    return queryGeometry.map((r) => {
        return r.map((p) => {
            return projectPoint(p, posMatrix, transform, z);
        });
    });
}

export default FillExtrusionStyleLayer;
