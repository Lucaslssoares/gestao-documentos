import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Dica ao passar o mouse ou focar com o teclado (Radix Tooltip). */
export function Dica({ texto, lado = "top", children }: { texto: string; lado?: "top" | "bottom" | "left" | "right"; children: ReactNode }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={lado} sideOffset={6} className="dica z-50 max-w-64">
          {texto}
          <Tooltip.Arrow className="fill-ink" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
