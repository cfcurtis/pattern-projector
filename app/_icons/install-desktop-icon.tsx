export default function InstallDesktopIcon({
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
      <path d="M320-120v-80H160q-33 0-56.5-23.5T80-280v-480q0-33 23.5-56.5T160-840h320v80H160v480h640v-120h80v120q0 33-23.5 56.5T800-200H640v80H320Zm360-280L480-600l56-56 104 103v-287h80v287l104-103 56 56-200 200Z" />
    </svg>
  );
}
