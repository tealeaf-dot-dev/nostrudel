import { PropsWithChildren, createContext, useContext } from "react";
import lib from "emojilib";

import useReplaceableEvents from "../../hooks/use-replaceable-events";
import useCurrentAccount from "../../hooks/use-current-account";
import { isEmojiTag } from "../../types/nostr-event";
import useFavoriteEmojiPacks from "../../hooks/use-favorite-emoji-packs";
import { getPackCordsFromFavorites } from "../../helpers/nostr/emoji-packs";

const defaultEmojis = Object.entries(lib).map(([char, [name, ...keywords]]) => ({
  name,
  keywords: [name, ...keywords],
  char,
}));

export type Emoji = { name: string; keywords: string[]; char: string; url?: string };

const EmojiContext = createContext<Emoji[]>([]);

export function useContextEmojis() {
  return useContext(EmojiContext);
}

export function DefaultEmojiProvider({ children }: PropsWithChildren) {
  return <EmojiProvider emojis={defaultEmojis}>{children}</EmojiProvider>;
}

export function UserEmojiProvider({ children, pubkey }: PropsWithChildren & { pubkey?: string }) {
  const account = useCurrentAccount();
  const favoriteList = useFavoriteEmojiPacks(pubkey || account?.pubkey, [], {
    ignoreCache: true,
    alwaysRequest: true,
  });

  const favoritePacks = useReplaceableEvents(favoriteList && getPackCordsFromFavorites(favoriteList));

  const emojis = favoritePacks
    .map((event) =>
      event.tags.filter(isEmojiTag).map((t) => ({ name: t[1], url: t[2], keywords: [t[1]], char: `:${t[1]}:` })),
    )
    .flat();

  return <EmojiProvider emojis={emojis}>{children}</EmojiProvider>;
}

export default function EmojiProvider({ children, emojis }: PropsWithChildren & { emojis: Emoji[] }) {
  const parent = useContext(EmojiContext);

  return <EmojiContext.Provider value={[...parent, ...emojis]}>{children}</EmojiContext.Provider>;
}
