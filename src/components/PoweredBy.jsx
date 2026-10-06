const LOGO = 'https://ftdfdozojlgvffomivrm.supabase.co/storage/v1/object/public/publico/logo-white.png';

export default function PoweredBy() {
  return (
    <a
      className="powered-by"
      href="https://www.instagram.com/profesia.ia/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by ProfesIA"
    >
      <span>Powered by</span>
      <img src={LOGO} alt="ProfesIA" height={26} />
    </a>
  );
}
