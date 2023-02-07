import { Avatar, MenuItem } from "@chakra-ui/react";
import { MenuIconButton, MenuIconButtonProps } from "../../../components/menu-icon-button";

import { ClipboardIcon, IMAGE_ICONS, SpyIcon } from "../../../components/icons";
import { Bech32Prefix, normalizeToBech32 } from "../../../helpers/nip-19";
import { useCopyToClipboard } from "react-use";
import { truncatedId } from "../../../helpers/nostr-event";
import identity from "../../../services/identity";
import { useUserMetadata } from "../../../hooks/use-user-metadata";
import { getUserDisplayName } from "../../../helpers/user-metadata";

export const UserProfileMenu = ({ pubkey, ...props }: { pubkey: string } & Omit<MenuIconButtonProps, "children">) => {
  const [_clipboardState, copyToClipboard] = useCopyToClipboard();
  const npub = normalizeToBech32(pubkey, Bech32Prefix.Pubkey);
  const metadata = useUserMetadata(pubkey);

  const loginAsUser = () => {
    if (confirm(`Do you want to logout and login as ${getUserDisplayName(metadata, pubkey)}?`)) {
      identity.logout();
      identity.loginWithPubkey(pubkey);
    }
  };

  return (
    <MenuIconButton {...props}>
      <MenuItem icon={<SpyIcon fontSize="1.5em" />} onClick={() => loginAsUser()}>
        Login as {getUserDisplayName(metadata, pubkey)}
      </MenuItem>
      {npub && (
        <MenuItem onClick={() => copyToClipboard(npub)} icon={<ClipboardIcon fontSize="1.5em" />}>
          Copy {truncatedId(npub)}
        </MenuItem>
      )}
      <MenuItem
        as="a"
        icon={<Avatar src={IMAGE_ICONS.nostrGuruIcon} size="xs" />}
        href={`https://www.nostr.guru/p/${npub}`}
        target="_blank"
      >
        Open in Nostr.guru
      </MenuItem>
      <MenuItem
        as="a"
        icon={<Avatar src={IMAGE_ICONS.astralIcon} size="xs" />}
        href={`https://astral.ninja/${npub}`}
        target="_blank"
      >
        Open in astral
      </MenuItem>
      <MenuItem
        as="a"
        icon={<Avatar src={IMAGE_ICONS.brbIcon} size="xs" />}
        href={`https://brb.io/u/${npub}`}
        target="_blank"
      >
        Open in BRB
      </MenuItem>
      <MenuItem
        as="a"
        icon={<Avatar src={IMAGE_ICONS.snortSocialIcon} size="xs" />}
        href={`https://snort.social/p/${npub}`}
        target="_blank"
      >
        Open in snort.social
      </MenuItem>
    </MenuIconButton>
  );
};
