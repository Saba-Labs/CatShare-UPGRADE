import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MdArrowBack,
  MdAutoAwesome,
  MdCloud,
  MdSecurity,
  MdSpeed,
  MdImage,
  MdEdit,
  MdShoppingBag,
  MdShare,
  MdPhoneAndroid,
  MdInventory2,
  MdPalette,
  MdCheckCircle,
  MdMenu,
  MdClose,
} from "react-icons/md";

const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.catshare.official";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45 },
};

export default function Website() {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [openFeature, setOpenFeature] = useState<string | null>(null);

  const pillars = [
    {
      title: "Your catalogue",
      subtitle: "Single source of truth",
      body: "Products, photos, subtitles, and custom fields—organised by category. Multiple catalogues with different prices for wholesale, distributors, and every channel you sell through.",
      icon: <MdInventory2 className="w-7 h-7" />,
    },
    {
      title: "Shareable order links",
      subtitle: "Customers order clearly",
      body: "Generate a link to a tidy order page: buyers pick quantities, see line totals and pack rules, then send the order to you on WhatsApp—less typing mistakes and fewer “how much?” chats.",
      icon: <MdShare className="w-7 h-7" />,
    },
    {
      title: "Share-ready visuals",
      subtitle: "Look professional",
      body: "Render product tiles with your prices and watermarks. Batch output images you can drop into WhatsApp, Instagram, or PDFs—without redesigning every slide.",
      icon: <MdImage className="w-7 h-7" />,
    },
  ];

  const features = [
    {
      id: "order-links",
      icon: <MdShoppingBag className="w-7 h-7" />,
      title: "Order forms & WhatsApp",
      blurb: "Public order pages from your live catalogue.",
      detail:
        "Share a secure link; customers adjust quantity, see subtotals, and open WhatsApp with a structured message. You keep control of pricing and stock context.",
    },
    {
      id: "multi-catalog",
      icon: <MdAutoAwesome className="w-7 h-7" />,
      title: "Multiple catalogues",
      blurb: "Different price lists, one product set.",
      detail:
        "Wholesale, reseller, or custom catalogues—each with its own prices and units while you maintain one master list of products.",
    },
    {
      id: "render",
      icon: <MdPalette className="w-7 h-7" />,
      title: "Image rendering & watermarks",
      blurb: "Branded PNGs in bulk.",
      detail:
        "Render catalogue tiles with watermark text, placement, and styling. Batch-render many products at once for campaigns or price updates.",
    },
    {
      id: "bulk",
      icon: <MdEdit className="w-7 h-7" />,
      title: "Bulk editing",
      blurb: "Update many SKUs at once.",
      detail:
        "Select multiple products to change categories, fields, or prices together—handy after supplier updates or seasonal changes.",
    },
    {
      id: "backup",
      icon: <MdCloud className="w-7 h-7" />,
      title: "Backup, restore & sync",
      blurb: "Protect years of catalogue work.",
      detail:
        "Export full backups (including images and catalogue setup). Cloud sync helps you pick up on another phone or after a reinstall.",
    },
    {
      id: "speed",
      icon: <MdSpeed className="w-7 h-7" />,
      title: "Built for daily use",
      blurb: "Fast on real devices.",
      detail:
        "Optimised lists, background rendering where it helps, and an interface tuned for shop-floor speed—not just demo screenshots.",
    },
    {
      id: "security",
      icon: <MdSecurity className="w-7 h-7" />,
      title: "Your account, your data",
      blurb: "Sign-in and sync you control.",
      detail:
        "Account-based access with encrypted traffic to sync servers. You choose what to share publicly (e.g. order links) vs. keep private in the app.",
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Set up your fields",
      text: "Pick the product fields that match your trade—sizes, SKUs, MOQ, or anything you track.",
    },
    {
      n: "02",
      title: "Build your catalogue",
      text: "Add products, photos, categories, and prices. Spin up extra catalogues for different buyers or margins.",
    },
    {
      n: "03",
      title: "Render or share",
      text: "Export polished images—or create an order link so customers choose qty and message you on WhatsApp.",
    },
    {
      n: "04",
      title: "Backup & grow",
      text: "Snapshot your data, sync across devices, and iterate as your range grows.",
    },
  ];

  const audiences = [
    "Wholesale & distributors",
    "Shops and teams using supplier price lists",
    "Resellers and multi-channel sellers",
    "Small brands sharing ranges on chat apps",
  ];

  const navItems = [
    { href: "#pillars", label: "Overview" },
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
  ] as const;

  const navLinkClass =
    "text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg";

  const desktopNav = (
    <>
      {navItems.map((item) => (
        <a key={item.href} href={item.href} className={`${navLinkClass} px-1 py-2`}>
          {item.label}
        </a>
      ))}
    </>
  );

  const mobileNavLinks = (
    <>
      {navItems.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`${navLinkClass} -mx-2 flex min-h-12 items-center px-3 py-2 active:bg-slate-100`}
          onClick={() => setMobileNav(false)}
        >
          {item.label}
        </a>
      ))}
    </>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 antialiased [text-size-adjust:100%]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
              aria-label="Go back"
            >
              <MdArrowBack className="h-5 w-5" />
              <span className="hidden text-sm font-medium sm:inline">Back</span>
            </button>
            <Link to="/website" className="flex items-center gap-2 min-w-0" onClick={() => setMobileNav(false)}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                <img src="/CatShare_logo.png" alt="" className="h-7 w-auto object-contain" />
              </span>
              <span className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">CatShare</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-6 lg:gap-8 md:flex">{desktopNav}</nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/login"
              className="min-h-10 rounded-full px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="min-h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:from-blue-500 hover:to-indigo-500"
            >
              Sign up
            </Link>
          </div>

          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 active:bg-slate-200 md:hidden"
            onClick={() => setMobileNav((v) => !v)}
            aria-expanded={mobileNav}
            aria-label={mobileNav ? "Close menu" : "Open menu"}
          >
            {mobileNav ? <MdClose className="h-6 w-6" /> : <MdMenu className="h-6 w-6" />}
          </button>
        </div>

        {mobileNav && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Page sections">
              {mobileNavLinks}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link
                to="/login"
                className="flex min-h-12 items-center justify-center rounded-xl text-center text-sm font-semibold text-slate-800 transition active:bg-slate-100"
                onClick={() => setMobileNav(false)}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-center text-sm font-semibold text-white transition active:opacity-90"
                onClick={() => setMobileNav(false)}
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.45), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(99, 102, 241, 0.25), transparent), radial-gradient(ellipse 50% 30% at 0% 80%, rgba(14, 165, 233, 0.2), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-24 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="mb-3 text-xs font-semibold tracking-wide text-sky-300/90 sm:mb-4 sm:text-sm">
              Share faster · Sell quicker
            </p>
            <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              The catalogue app for sellers who live on WhatsApp.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 text-pretty sm:mt-6 sm:text-lg lg:text-xl">
              CatShare keeps your products, prices, and pack rules organised—then turns them into{" "}
              <span className="font-semibold text-white">shareable order pages</span> and{" "}
              <span className="font-semibold text-white">branded product images</span> so buyers know what to order and what it costs.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                to="/register"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-slate-100 active:scale-[0.99] sm:w-auto"
              >
                Create free account
              </Link>
              <a
                href={PLAY_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.99] sm:w-auto"
              >
                <MdPhoneAndroid className="h-5 w-5 shrink-0" />
                Google Play
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-3"
          >
            {[
              { k: "Order links", v: "Qty + line totals → WhatsApp" },
              { k: "Multi-catalogue", v: "Wholesale, custom price lists" },
              { k: "Renders", v: "Watermarks & batch export" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 backdrop-blur-sm sm:py-4"
              >
                <div className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-200/80 sm:text-xs">{s.k}</div>
                <div className="mt-1 text-sm font-medium leading-snug text-slate-200">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Three pillars */}
      <section id="pillars" className="scroll-mt-[4.5rem] border-b border-slate-200 bg-white py-12 sm:scroll-mt-28 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              What CatShare does
            </h2>
            <p className="mt-3 text-pretty text-sm text-slate-600 sm:text-base">
              Three connected ideas—so your range stays consistent whether you share a price list or take an order.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-3">
            {pillars.map((p, i) => (
              <motion.article
                key={p.title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6 lg:p-8"
              >
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-lg shadow-blue-600/25">
                  {p.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900">{p.title}</h3>
                <p className="mt-1 text-sm font-semibold text-blue-600">{p.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="scroll-mt-[4.5rem] py-12 sm:scroll-mt-28 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              Everything in one place
            </h2>
            <p className="mt-3 text-pretty text-sm text-slate-600 sm:text-base">
              Tap a card for a bit more detail—no account required to read this page.
            </p>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {features.map((f, i) => {
              const expanded = openFeature === f.id;
              return (
                <motion.button
                  key={f.id}
                  type="button"
                  {...fadeUp}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.24) }}
                  onClick={() => setOpenFeature(expanded ? null : f.id)}
                  className={`min-h-[5.5rem] rounded-2xl border p-4 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-0 sm:p-5 ${
                    expanded
                      ? "border-blue-400 bg-gradient-to-b from-blue-50 to-white shadow-md ring-1 ring-blue-100"
                      : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow"
                  }`}
                >
                  <div className={`mb-3 inline-flex rounded-lg p-2 ${expanded ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.blurb}</p>
                  {expanded && (
                    <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-600">{f.detail}</p>
                  )}
                  <span className="mt-3 inline-block text-xs font-semibold text-blue-600">
                    {expanded ? "Tap to close" : "Tap for more"}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-[4.5rem] border-y border-slate-200 bg-gradient-to-b from-slate-100/80 to-white py-12 sm:scroll-mt-28 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-pretty text-sm text-slate-600 sm:text-base">
              From empty catalogue to shared orders and images.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <span className="text-3xl font-black tabular-nums text-blue-600/20">{s.n}</span>
                <h3 className="mt-2 font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience + trust */}
      <section className="py-12 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:gap-12 sm:px-6 lg:grid-cols-2 lg:items-center">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              Built for real selling workflows
            </h2>
            <p className="mt-4 text-pretty text-sm text-slate-600 sm:text-base">
              If you already send PDFs, voice notes, or photo collages to confirm orders, CatShare replaces the guesswork with structured catalogue data—without forcing you into a heavy ERP.
            </p>
            <ul className="mt-5 space-y-3 sm:mt-6">
              {audiences.map((a) => (
                <li key={a} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                  <MdCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <span className="font-medium leading-snug">{a}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            {...fadeUp}
            className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8"
          >
            <h3 className="text-lg font-bold sm:text-xl">Why teams stick with it</h3>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300 sm:mt-6 sm:space-y-4">
              <li className="flex gap-3">
                <MdCheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>Mobile-first: manage the floor from your phone.</span>
              </li>
              <li className="flex gap-3">
                <MdCheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>Cloud backup and sync across devices when you sign in.</span>
              </li>
              <li className="flex gap-3">
                <MdCheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                <span>Pro features available—start with a trial and upgrade when you need more.</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 py-12 text-center text-white sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">
            Try CatShare on your next catalogue update
          </h2>
          <p className="mt-4 text-base text-blue-100 text-pretty sm:text-lg">
            Sign up in the app, add a few products, and share your first order link or render.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:bg-blue-50 active:scale-[0.99]"
            >
              Get started
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-white/40 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.99]"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-slate-400 sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-4 sm:flex-row sm:gap-6 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/CatShare_logo.png" alt="" className="h-8 w-auto opacity-90" />
            <span className="font-semibold text-slate-200">CatShare</span>
          </div>
          <nav
            className="flex w-full max-w-sm flex-col items-stretch gap-1 text-sm sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-2"
            aria-label="Footer"
          >
            <Link to="/login" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1">
              Log in
            </Link>
            <Link to="/register" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1">
              Sign up
            </Link>
            <a
              href={PLAY_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1"
            >
              Google Play
            </a>
            <Link to="/privacy" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1">
              Privacy
            </Link>
            <Link to="/terms" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1">
              Terms
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} CatShare · BazelWings
        </p>
      </footer>
    </div>
  );
}
