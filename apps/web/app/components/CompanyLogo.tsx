import { SiBaidu, SiHuawei } from "react-icons/si";

export function CompanyLogo({ company, logoUrl, decorative = false }: { company: string; logoUrl?: string; decorative?: boolean }) {
  const label = decorative ? undefined : `${company} Logo`;
  if (company === "百度") return <SiBaidu color="#2932e1" role={decorative ? undefined : "img"} aria-label={label} aria-hidden={decorative || undefined} />;
  if (company === "华为") return <SiHuawei color="#cf0a2c" role={decorative ? undefined : "img"} aria-label={label} aria-hidden={decorative || undefined} />;
  if (logoUrl?.startsWith("http")) return <img src={logoUrl} alt={decorative ? "" : `${company} Logo`} referrerPolicy="no-referrer" />;
  return <span className="company-logo-fallback" aria-hidden={decorative || undefined}>{company.slice(0, 1)}</span>;
}
