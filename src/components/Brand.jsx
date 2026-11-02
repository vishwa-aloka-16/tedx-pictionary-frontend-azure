import BrandLogos from "./BrandLogos";

export default function Brand({
  connection,
  title,
}) {
  let connectionText = "Ready";

  if (connection === "connecting") {
    connectionText = "Connecting";
  }

  if (connection === "disconnected") {
    connectionText = "Disconnected";
  }

  if (connection === "connected") {
    connectionText = "Game connected";
  }

  return (
    <header className="navigation">
      <BrandLogos />
      {title && <h1 className="navigation-title">{title}</h1>}

      <div
        className={`connection connection--${
          connection || "connected"
        }`}
      >
        <span className="connection-dot" />
        {connectionText}
      </div>
    </header>
  );
}
