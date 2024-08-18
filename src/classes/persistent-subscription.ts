import { nanoid } from "nanoid";
import { Filter, Relay } from "nostr-tools";
import { AbstractRelay, Subscription, SubscriptionParams } from "nostr-tools/abstract-relay";

import relayPoolService from "../services/relay-pool";
import Process from "./process";
import FilterFunnel01 from "../components/icons/filter-funnel-01";
import processManager from "../services/process-manager";
import { isFilterEqual } from "../helpers/nostr/filter";

export default class PersistentSubscription {
  id: string;
  process: Process;
  relay: Relay;
  filters: Filter[];
  closed = true;
  params: Partial<SubscriptionParams>;

  subscription: Subscription | null = null;
  get eosed() {
    return !!this.subscription?.eosed;
  }

  constructor(relay: AbstractRelay, params?: Partial<SubscriptionParams>) {
    this.id = nanoid(8);
    this.process = new Process("PersistentSubscription", this, [relay]);
    this.process.icon = FilterFunnel01;
    this.filters = [];
    this.params = {
      //@ts-expect-error
      id: this.id,
      ...params,
    };

    this.relay = relay;

    processManager.registerProcess(this.process);
  }

  /** attempts to update the subscription */
  async update() {
    if (!this.filters || this.filters.length === 0) throw new Error("Missing filters");

    if (!(await relayPoolService.waitForOpen(this.relay))) throw new Error("Failed to connect to relay");

    // check if its possible to subscribe to this relay
    if (!relayPoolService.canSubscribe(this.relay)) throw new Error("Cant subscribe to relay");

    this.closed = false;
    this.process.active = true;

    // recreate the subscription if its closed since nostr-tools cant reopen a sub
    if (!this.subscription || this.subscription.closed) {
      this.subscription = this.relay.subscribe(this.filters, {
        ...this.params,
        oneose: () => {
          this.params.oneose?.();
        },
        onclose: (reason) => {
          if (!this.closed) {
            relayPoolService.handleRelayNotice(this.relay, reason);

            this.closed = true;
            this.process.active = false;
          }
          this.params.onclose?.(reason);
        },
      });
    } else if (isFilterEqual(this.subscription.filters, this.filters) === false) {
      this.subscription.filters = this.filters;
      // NOTE: reset the eosed flag since nostr-tools dose not
      this.subscription.eosed = false;
      this.subscription.fire();
    } else throw new Error("Subscription filters have not changed");
  }
  close() {
    if (this.closed) return this;

    this.closed = true;
    if (this.subscription?.closed === false) this.subscription.close();
    this.process.active = false;

    return this;
  }

  destroy() {
    this.close();
    this.process.remove();
    processManager.unregisterProcess(this.process);
  }
}
