import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Lets the dev server serve HMR/static assets when reached over the LAN
  // (e.g. testing the public booking flow from a phone), not just
  // localhost. Dev-only; irrelevant to a production build.
  allowedDevOrigins: ["192.168.100.49"],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
