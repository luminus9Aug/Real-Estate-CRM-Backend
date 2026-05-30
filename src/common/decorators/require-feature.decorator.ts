import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../constants/features.constants';

export const FEATURE_KEY_METADATA = 'feature_key';
export const RequireFeature = (featureKey: FeatureKey) => 
  SetMetadata(FEATURE_KEY_METADATA, featureKey);
