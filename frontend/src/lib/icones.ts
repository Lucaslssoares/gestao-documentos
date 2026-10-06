import { Building2, FileText, Folder, Package, Receipt, Scale, Tractor, Users, Wallet, type LucideIcon } from "lucide-react";

/** Ícones disponíveis para categorias (o nome fica gravado em categorias.icone). */
export const ICONES_CATEGORIA: Record<string, LucideIcon> = {
  scale: Scale,
  wallet: Wallet,
  receipt: Receipt,
  package: Package,
  users: Users,
  "building-2": Building2,
  tractor: Tractor,
  folder: Folder,
  "file-text": FileText,
};
