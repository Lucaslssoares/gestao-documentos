import clsx from "clsx";
import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Peças de animação do sistema (motion). Entradas curtas (≤ 0,3 s) para dar vida às telas
 * sem atrasar a pessoa; tudo respeita "reduzir movimento" (MotionConfig no main.tsx).
 */

const MOLA = { type: "spring", stiffness: 380, damping: 32 } as const;

/** Bloco que entra subindo levemente. */
export function Entrada({ atraso = 0, className, children, ...props }: HTMLMotionProps<"div"> & { atraso?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1], delay: atraso }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Contêiner que faz os filhos (<ItemEscalonado>) entrarem um após o outro. */
export function Escalonado({ as = "div", passo = 0.045, className, children }: { as?: "div" | "ul" | "section"; passo?: number; className?: string; children: ReactNode }) {
  const Componente = motion[as];
  return (
    <Componente initial="oculto" animate="visivel" variants={{ visivel: { transition: { staggerChildren: passo } } }} className={className}>
      {children}
    </Componente>
  );
}

export function ItemEscalonado({ as = "div", className, children, ...props }: { as?: "div" | "li" } & HTMLMotionProps<"div">) {
  const Componente = motion[as] as typeof motion.div;
  return (
    <Componente
      variants={{ oculto: { opacity: 0, y: 10 }, visivel: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.23, 1, 0.32, 1] } } }}
      className={className}
      {...props}
    >
      {children}
    </Componente>
  );
}

/** Cartão que "levanta" com mola no hover e afunda no clique. */
export function Elevar({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} transition={MOLA} className={className} {...props}>
      {children}
    </motion.div>
  );
}

const formato = new Intl.NumberFormat("pt-BR");

/** Número que conta de 0 até o valor quando aparece na tela. */
export function Contador({ valor, className }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visivel = useInView(ref, { once: true });
  const reduzir = useReducedMotion();
  const [exibido, setExibido] = useState(0);

  useEffect(() => {
    if (!visivel || reduzir) return;
    const controle = animate(0, valor, { duration: 0.9, ease: [0.23, 1, 0.32, 1], onUpdate: (v) => setExibido(Math.round(v)) });
    return () => controle.stop();
  }, [valor, visivel, reduzir]);

  return (
    <span ref={ref} className={clsx("tabular-nums", className)}>
      {formato.format(reduzir ? valor : exibido)}
    </span>
  );
}

/** Linhas-esqueleto no lugar de "Carregando..." enquanto os dados chegam. */
export function EsqueletoLista({ linhas = 4, className }: { linhas?: number; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={clsx("divide-y divide-line-soft", className)}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <span className="esqueleto size-9 shrink-0 rounded-xl" />
          <span className="flex-1 space-y-2">
            <span className="esqueleto block h-3.5" style={{ width: `${70 - i * 9}%` }} />
            <span className="esqueleto block h-3 w-1/3" />
          </span>
        </div>
      ))}
    </div>
  );
}
