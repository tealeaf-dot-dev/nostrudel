import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from "react";
import { useToast } from "@chakra-ui/react";
import { EventTemplate, NostrEvent, UnsignedEvent, kinds } from "nostr-tools";
import { includeClientTag } from "applesauce-factory/operations";
import { addSeenRelay } from "applesauce-core/helpers";

import { useSigningContext } from "./signing-provider";
import { DraftNostrEvent } from "../../types/nostr-event";
import PublishAction from "../../classes/nostr-publish-action";
import clientRelaysService from "../../services/client-relays";
import RelaySet from "../../classes/relay-set";
import { cloneEvent, getAllRelayHints, isReplaceable } from "../../helpers/nostr/event";
import replaceableEventsService from "../../services/replaceable-events";
import { localRelay } from "../../services/local-relay";
import deleteEventService from "../../services/delete-events";
import localSettings from "../../services/local-settings";
import { NEVER_ATTACH_CLIENT_TAG, NIP_89_CLIENT_APP } from "../../const";
import { eventStore } from "../../services/event-store";
import useCurrentAccount from "../../hooks/use-current-account";
import { useUserOutbox } from "../../hooks/use-user-mailboxes";

type PublishContextType = {
  log: PublishAction[];
  finalizeDraft(draft: EventTemplate | NostrEvent): Promise<UnsignedEvent>;
  publishEvent(
    label: string,
    event: EventTemplate | UnsignedEvent | NostrEvent,
    additionalRelays: Iterable<string> | undefined,
    quite: false,
    onlyAdditionalRelays: false,
  ): Promise<PublishAction>;
  publishEvent(
    label: string,
    event: EventTemplate | UnsignedEvent | NostrEvent,
    additionalRelays: Iterable<string> | undefined,
    quite: false,
    onlyAdditionalRelays?: boolean,
  ): Promise<PublishAction>;
  publishEvent(
    label: string,
    event: EventTemplate | UnsignedEvent | NostrEvent,
    additionalRelays?: Iterable<string> | undefined,
    quite?: boolean,
    onlyAdditionalRelays?: boolean,
  ): Promise<PublishAction | undefined>;
};
export const PublishContext = createContext<PublishContextType>({
  log: [],
  finalizeDraft: () => {
    throw new Error("Publish provider not setup");
  },
  publishEvent: async () => {
    throw new Error("Publish provider not setup");
  },
});

export function usePublishEvent() {
  return useContext(PublishContext).publishEvent;
}
export function useFinalizeDraft() {
  return useContext(PublishContext).finalizeDraft;
}

export default function PublishProvider({ children }: PropsWithChildren) {
  const toast = useToast();
  const [log, setLog] = useState<PublishAction[]>([]);
  const { requestSignature, finalizeDraft: signerFinalize } = useSigningContext();
  const account = useCurrentAccount();
  const outBoxes = useUserOutbox(account?.pubkey);

  const finalizeDraft = useCallback<PublishContextType["finalizeDraft"]>(
    (event: EventTemplate | NostrEvent) => signerFinalize(event),
    [signerFinalize],
  );

  const publishEvent = useCallback(
    async (
      label: string,
      event: DraftNostrEvent | NostrEvent,
      additionalRelays?: Iterable<string>,
      quite = true,
      onlyAdditionalRelays = false,
    ) => {
      try {
        let relays;
        if (onlyAdditionalRelays) {
          relays = RelaySet.from(additionalRelays);
        } else {
          relays = RelaySet.from(
            clientRelaysService.writeRelays.value,
            outBoxes,
            additionalRelays,
            getAllRelayHints(event),
          );
        }

        // add pubkey to event
        if (!Reflect.has(event, "pubkey")) event = await finalizeDraft(event);

        // sign event
        const signed = !Reflect.has(event, "sig") ? await requestSignature(event) : (event as NostrEvent);

        const pub = new PublishAction(label, relays, signed);
        setLog((arr) => arr.concat(pub));

        pub.onResult.subscribe((result) => {
          if (result.success) addSeenRelay(signed, result.relay.url);
        });

        // send it to the local relay
        if (localRelay) localRelay.publish(signed);

        // pass it to other services
        eventStore.add(signed);
        if (isReplaceable(signed.kind)) replaceableEventsService.handleEvent(signed);
        if (signed.kind === kinds.EventDeletion) deleteEventService.handleEvent(signed);
        return pub;
      } catch (e) {
        if (e instanceof Error) toast({ description: e.message, status: "error" });
        if (!quite) throw e;
      }
    },
    [toast, setLog, requestSignature, finalizeDraft, outBoxes],
  ) as PublishContextType["publishEvent"];

  const context = useMemo<PublishContextType>(
    () => ({
      publishEvent,
      finalizeDraft,
      log,
    }),
    [publishEvent, finalizeDraft, log],
  );

  return <PublishContext.Provider value={context}>{children}</PublishContext.Provider>;
}
