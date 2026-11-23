import { Icon } from "solid-heroicons";
import { ellipsisVertical } from "solid-heroicons/solid";
import {
    chartBar,
    cog_6Tooth,
    envelope,
    globeAlt,
    heart,
    questionMarkCircle,
} from "solid-heroicons/solid-mini";
import { Component, Show } from "solid-js";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuIcon,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./common/DropdownMenu";
import { cn } from "../utils/style";
import { buttonVariants } from "./common/Button";
import { useMedia } from "../hooks/useMedia";

type Props = {
    setShowSettings: (show: boolean) => void;
    setShowFAQ: (show: boolean) => void;
    setShowPredictionLog: (show: boolean) => void;
};

export const OptionsDropdownMenu: Component<Props> = (props) => {
    const { isDesktop } = useMedia();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <button
                    class={cn(
                        buttonVariants({ variant: "transparent" }),
                        "px-1 py-2",
                    )}
                >
                    <Icon path={ellipsisVertical} class="w-7" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
                <DropdownMenuLabel>Draftgap</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        onSelect={() => props.setShowSettings(true)}
                    >
                        <DropdownMenuIcon path={cog_6Tooth} />
                        <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => props.setShowFAQ(true)}>
                        <DropdownMenuIcon path={questionMarkCircle} />
                        <span>FAQ</span>
                    </DropdownMenuItem>
                    <Show when={isDesktop}>
                        <DropdownMenuItem
                            onSelect={() => props.setShowPredictionLog(true)}
                        >
                            <DropdownMenuIcon path={chartBar} />
                            <span>Prediction log</span>
                        </DropdownMenuItem>
                    </Show>
                    <DropdownMenuItem asChild>
                        <a
                            href="mailto:vigovlugt+draftgap@gmail.com"
                            target="_blank"
                            class="flex items-center"
                        >
                            <DropdownMenuIcon path={envelope} />
                            <span>Contact</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href="https://leagueofitems.com"
                            target="_blank"
                            class="flex items-center"
                        >
                            <DropdownMenuIcon path={globeAlt} />
                            <span>LeagueOfItems</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href="https://www.buymeacoffee.com/vigovlugt"
                            target="_blank"
                            class="flex items-center"
                        >
                            <DropdownMenuIcon path={heart} />
                            <span>Donate</span>
                        </a>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
