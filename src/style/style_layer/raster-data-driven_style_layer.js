// @flow

import StyleLayer from '../style_layer';

import properties from './raster-data-driven_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import type {PaintProps} from './raster-data-driven_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';

class RasterDataDrivenStyleLayer extends StyleLayer {
     _lookupTexture: ImageData;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this._lookupTexture = layer.lookupTexture;
    }

    setGradientTexture(texture: ImageData) {
        this._lookupTexture = texture;
    }
}

export default RasterDataDrivenStyleLayer;
