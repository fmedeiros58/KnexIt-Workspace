import type { DeliveryChannel, DeliveryFormat } from "../../shared/enums/delivery-enums";

export interface DeliveryStateContract {
  channel: DeliveryChannel;
  format: DeliveryFormat;
  body: string;
  retryable: boolean;
}
