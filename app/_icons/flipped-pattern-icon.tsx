export default function FlippedPatternIcon({
  ariaLabel,
}: {
  ariaLabel: string;
}) {
  return (
    <svg
      aria-label={ariaLabel}
      xmlns="http://www.w3.org/2000/svg"
      height="24px"
      viewBox="0 -960 960 960"
      width="24px"
      fill="currentColor"
    >
      <path d="M487-104 150-440h114l280 280 200-200H640v-80h240v240h-80v-104L600-104q-23 23-56.5 23T487-104ZM80-520v-240h80v104l200-200q23-23 56.5-23t56.5 23l337 336H696L416-800 216-600h104v80H80Z" />
    </svg>
  );
}
