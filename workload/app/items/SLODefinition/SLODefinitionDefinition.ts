
/***
 * Interface representing the definition of an SLODefinition item.
 * This information is stored in Fabric as Item definition.
 * It will be returned once the item definition is loaded.
 */
export interface SLODefinitionDefinition {
  itemId?: string;
  itemType?: string;
  metricType?: string;
  targetValue?: number;
  warningThreshold?: number;
  evaluationWindow?: string;
}
