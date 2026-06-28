import Script from "next/script";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Script
        src="https://convoapp.com.au/widget.js"
        strategy="afterInteractive"
        data-tenant="1b1e9890-4a0c-4370-9424-d989dcb85e29"
      />
    </>
  );
}
