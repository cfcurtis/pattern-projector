"use client";

import { useRouter, usePathname } from 'next/navigation';

const LanguageSwitcher: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.substr(1, 2)
  console.log(locale)

  const handleLanguageChange = e => {
    router.push(e.target.value)
    //console.log(e.target.value)
  };

  // Unicode escape sequences for flag emojis
  const flags = {
    de: '\uD83C\uDDE9\uD83C\uDDEA', // DE flag for German
    dk: '\uD83C\uDDE9\uD83C\uDDF0', // DK flag for Danish
    nl: '\uD83C\uDDF3\uD83C\uDDF1',  // NL flag for Dutch
    us: '\uD83C\uDDFA\uD83C\uDDF8'  // US flag for English
  };

  return (
    <select onChange={handleLanguageChange} value={locale}>
      <option value="de">{flags.de} Deutsch</option>
      <option value="da">{flags.dk} Danish</option>
      <option value="nl">{flags.nl} Nederlands</option>
      <option value="en">{flags.us} English</option>
    </select>
  );
};

export default LanguageSwitcher;
