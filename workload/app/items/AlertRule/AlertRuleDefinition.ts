
/***
 * Interface representing the definition of an AlertRule item.
 * This information is stored in Fabric as Item definition.
 * It will be returned once the item definition is loaded.
 */
export interface AlertRuleDefinition {
  sloId?: string;
  condition?: string;
  threshold?: number;
  notificationType?: string;
  target?: string;
  cooldown?: number;
  enabled?: boolean;
}
