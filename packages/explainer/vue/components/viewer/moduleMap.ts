import { buildModuleMap } from '../../../modules/registry';

/**
 * Module type -> viewer component map, built from the module registry.
 * This is the bridge between the viewer and the module system.
 */
export const moduleMap = buildModuleMap();
