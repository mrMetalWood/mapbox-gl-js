// @flow

import StyleLayer from '../style_layer';

import FillExtrusionBucket from '../../data/bucket/fill_extrusion_bucket';
import { multiPolygonIntersectsMultiPolygon } from '../../util/intersection_tests';
import { translateDistance, translate } from '../query_utils';
import properties from './fill_extrusion_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';
import {vec4} from 'gl-matrix';
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
        const translatedPolygon = translate(queryGeometry,
            this.paint.get('fill-extrusion-translate'),
            this.paint.get('fill-extrusion-translate-anchor'),
            transform.angle, pixelsToTileUnits);

        const height = this.paint.get('fill-extrusion-height').evaluate(feature);
        const base = this.paint.get('fill-extrusion-base').evaluate(feature);

        const projectedQueryGeometry = projectQueryGeometry(translatedPolygon, posMatrix, transform, 0);
        const projectedTop = projectQueryGeometry(geometry, posMatrix, transform, height);
        const projectedBase = projectQueryGeometry(geometry, posMatrix, transform, base);

        if (multiPolygonIntersectsMultiPolygon(projectedQueryGeometry, projectedTop)) return true;

        for (let r = 0; r < projectedTop.length; r++) {
            const ringTop = projectedTop[r];
            const ringBase = projectedBase[r];
            for (let p = 0; p < ringTop.length - 1; p++) {
                const topA = ringTop[p];
                const topB = ringTop[p + 1];
                const baseA = ringBase[p];
                const baseB = ringBase[p + 1];
                if (multiPolygonIntersectsMultiPolygon(projectedQueryGeometry, [[topA, topB, baseB, baseA, topA]])) return true;
            }
        }

        return false;
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

function projectPoint(p: Point, posMatrix: Float32Array, transform: Transform, z: number) {
    const point = vec4.transformMat4([], [p.x, p.y, z, 1], posMatrix);
    return new Point(
            (point[0] / point[3] + 1) * transform.width * 0.5,
            (point[1] / point[3] + 1) * transform.height * 0.5);
}

function projectQueryGeometry(queryGeometry: Array<Array<Point>>, posMatrix: Float32Array, transform: Transform, z: number) {
    return queryGeometry.map((r) => {
        return r.map((p) => {
            return projectPoint(p, posMatrix, transform, z);
        });
    });
}

export default FillExtrusionStyleLayer;
