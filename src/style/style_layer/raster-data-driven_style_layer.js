// @flow

import StyleLayer from '../style_layer';

import properties from './raster-data-driven_style_layer_properties';
import { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';

import { RGBAImage } from '../../util/image';
import renderColorRamp from '../../util/color_ramp';

import type Texture from '../../render/texture';
import type {PaintProps} from './raster-data-driven_style_layer_properties';
import type {LayerSpecification} from '../../style-spec/types';

class RasterDataDrivenStyleLayer extends StyleLayer {

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(layer: LayerSpecification) {
        super(layer, properties);

        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'raster-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['raster-color'].value.expression;

        this.colorRamp = renderColorRamp(expression, 'rasterDensity');
        this.colorRampTexture = null;
    }
}

export default RasterDataDrivenStyleLayer;
