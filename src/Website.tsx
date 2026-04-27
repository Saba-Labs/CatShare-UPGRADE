import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { logWebsiteCtaClicked, logWebsiteVisited } from "./config/analyticsEvents";
import {
  MdArrowBack,
  MdAutoAwesome,
  MdInventory2,
  MdEdit,
  MdStorefront,
  MdShare,
  MdImage,
  MdCheckCircle,
  MdMenu,
  MdClose,
} from "react-icons/md";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45 },
};

const softFloat = {
  animate: { y: [0, -6, 0] },
  transition: { duration: 3.8, repeat: Infinity, ease: "easeInOut" as const },
};

export default function Website() {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    logWebsiteVisited("in_app");
  }, []);

  const aboutSections = [
    {
      title: "What is CatShare?",
      subtitle: "A mobile-first catalogue + order workflow app",
      body: "One app for products, prices, categories, and share links. Built for WhatsApp and Instagram sellers.",
      icon: <MdInventory2 className="w-7 h-7" />,
    },
    {
      title: "Who is it for?",
      subtitle: "Sellers, wholesalers, resellers, and small teams",
      body: "Perfect for teams that update prices often and sell daily through WhatsApp and Instagram.",
      icon: <MdShare className="w-7 h-7" />,
    },
    {
      title: "Why users stay",
      subtitle: "Speed, clarity, and trust",
      body: "Reduce order mistakes. Faster sharing. Better presentation. Less daily stress.",
      icon: <MdImage className="w-7 h-7" />,
    },
  ];

  const featureShowcase = [
    {
      icon: <MdInventory2 className="w-7 h-7" />,
      title: "Fully Custom Product Fields",
      blurb: "Set up the exact fields your business needs.",
      detail: "Sizes, packaging, units, and custom labels for cleaner product communication.",
      image: "/about-fields.png",
      reverse: false,
    },
    {
      icon: <MdEdit className="w-7 h-7" />,
      title: "Bulk Editor (Save Time)",
      blurb: "Update many products in one go.",
      detail: "Fast edits for prices, names, and values when supplier or seasonal changes happen.",
      image: "/about-bulk.png",
      reverse: true,
    },
    {
      icon: <MdAutoAwesome className="w-7 h-7" />,
      title: "Multi-Currency Support",
      blurb: "Sell confidently in different pricing currencies.",
      detail: "Switch and manage currency display cleanly for broader customer reach.",
      image: "/about-currency.png",
      reverse: false,
    },
    {
      icon: <MdStorefront className="w-7 h-7" />,
      title: "Online Store",
      blurb: "Turn your catalogue into a live storefront link in minutes.",
      detail:
        "Share one clean store URL where buyers can browse by category, check product details, and place orders without asking you for every item manually. Update products once in CatShare and your storefront stays current for all customers.",
      image: "/about-store.png",
      reverse: true,
    },
    {
      icon: <MdShare className="w-7 h-7" />,
      title: "Share Features",
      blurb: "Share as image, PDF, link, or online store.",
      detail: "One tap sharing options for faster sales conversations and better buyer clarity.",
      image: "/about-share.png",
      reverse: false,
    },
  ];

  const navItems = [
    { href: "#about", label: "About" },
    { href: "#features", label: "Features" },
    { href: "#start", label: "Start" },
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
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#edf4ff] via-[#f4f2ff] to-[#eef6ff] pb-24 text-slate-900 antialiased [text-size-adjust:100%] md:pb-0">
      <div className="fixed inset-x-0 top-0 z-[60] h-[40px] bg-black" aria-hidden />

      {/* Header */}
      <header className="sticky top-[40px] z-50 border-b border-blue-100/80 bg-white/75 backdrop-blur-xl supports-[backdrop-filter]:bg-white/65">
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
              onClick={() => logWebsiteCtaClicked("header_login", "website")}
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="min-h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:from-blue-500 hover:to-indigo-500"
              onClick={() => logWebsiteCtaClicked("header_signup", "website")}
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
                onClick={() => {
                  setMobileNav(false);
                  logWebsiteCtaClicked("mobile_menu_login", "website");
                }}
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-center text-sm font-semibold text-white transition active:opacity-90"
                onClick={() => {
                  setMobileNav(false);
                  logWebsiteCtaClicked("mobile_menu_signup", "website");
                }}
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden text-slate-900">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full bg-blue-400/20 blur-3xl"
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute right-0 top-24 h-52 w-52 rounded-full bg-indigo-400/20 blur-3xl"
          animate={{ x: [0, -22, 0], y: [0, 10, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl"
          animate={{ x: [0, 14, 0], y: [0, -12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(59,130,246,0.2), transparent), radial-gradient(ellipse 80% 60% at 100% 0%, rgba(168,85,247,0.16), transparent), radial-gradient(ellipse 70% 50% at 60% 100%, rgba(14,165,233,0.12), transparent), linear-gradient(180deg, #eef4ff 0%, #f2f7ff 100%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-10 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold tracking-wide text-blue-700 sm:mb-4 sm:text-sm">
              About CatShare
            </p>
            <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-6xl">
              Share Faster<br />Sell Quicker
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 text-pretty sm:mt-6 sm:text-lg">
              CatShare keeps your catalogue, order flow, and sharing workflow in one clean mobile system.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
              <motion.div {...softFloat} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link
                  to="/register"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 sm:w-auto"
                  onClick={() => logWebsiteCtaClicked("hero_signup", "website")}
                >
                  Create free account
                </Link>
              </motion.div>
              <motion.div {...softFloat} transition={{ ...softFloat.transition, delay: 0.35 }} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Link
                  to="/login"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  onClick={() => logWebsiteCtaClicked("hero_login", "website")}
                >
                  I already have an account
                </Link>
              </motion.div>
            </div>
          </motion.div>
          <motion.div
            {...fadeUp}
            className="overflow-hidden rounded-3xl border border-blue-100 bg-white p-3 shadow-xl shadow-blue-100/60"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ y: -10, scale: 1.01 }}
          >
            <img
              src="/about-store.png"
              alt="CatShare storefront preview"
              className="h-56 w-full rounded-2xl object-cover sm:h-72 lg:h-[22rem]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="grid gap-3 sm:grid-cols-3 lg:col-span-2"
          >
              {[
                { k: "Mobile first", v: "Designed for daily phone-based selling" },
                { k: "All-in-one", v: "Catalogue + orders + store + visual sharing" },
                { k: "Team speed", v: "Bulk operations and reusable configurations" },
              ].map((s) => (
              <div
                key={s.k}
                className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-[#f5f9ff] to-[#f4f2ff] px-4 py-3.5 shadow-sm sm:py-4"
              >
                <div className="text-[0.65rem] font-bold uppercase tracking-wider text-blue-600 sm:text-xs">{s.k}</div>
                <div className="mt-1 text-sm font-medium leading-snug text-slate-700">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            {...fadeUp}
            className="rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-[#f6f9ff] to-[#eff4ff] p-4 shadow-md shadow-blue-100/40 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700 sm:text-sm">
              <span className="rounded-full bg-blue-100 px-3 py-1">Trusted by growing sellers</span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Made for WhatsApp + Instagram selling</span>
            </div>
            <div className="mt-4 grid gap-3 sm:mt-5 md:grid-cols-3">
              {[
                "Looks clean and professional while sharing with customers.",
                "Daily catalogue updates are much faster with bulk edits.",
                "Less confusion in orders because details are always clear.",
              ].map((quote) => (
                <div key={quote} className="rounded-2xl border border-blue-100 bg-white/90 p-4 text-sm text-slate-700 shadow-sm">
                  <p>{quote}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <div aria-hidden className="mx-auto h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      {/* About blocks */}
      <section id="about" className="scroll-mt-[4.5rem] bg-gradient-to-b from-[#f4f8ff] to-[#f4f3ff] py-12 sm:scroll-mt-28 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              Why CatShare
            </h2>
            <p className="mt-3 text-pretty text-sm text-slate-600 sm:text-base">
              A friendly mobile workflow that helps teams look professional, move faster, and reduce costly order confusion.
            </p>
          </motion.div>
          <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-3">
            {aboutSections.map((p, i) => (
              <motion.article
                key={p.title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="group rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-[#f8fbff] to-[#f3f8ff] p-5 shadow-md shadow-blue-100/40 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
              >
                <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-lg shadow-blue-600/25">
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

      <div aria-hidden className="mx-auto h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />

      {/* Features grid */}
      <section id="features" className="scroll-mt-[4.5rem] bg-gradient-to-b from-[#f3f6ff] to-[#eef5ff] py-12 sm:scroll-mt-28 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
              Core Features
            </h2>
            <p className="mt-3 text-pretty text-sm text-slate-600 sm:text-base">
              Core features designed to improve day-to-day selling and customer experience.
            </p>
          </motion.div>

          <div className="mt-8 space-y-4 sm:mt-10 sm:space-y-5">
            {featureShowcase.map((f, i) => (
              <motion.article
                key={f.title}
                {...fadeUp}
                transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.24) }}
                className={`grid overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-[#f8fbff] to-[#f2f5ff] shadow-md shadow-blue-100/40 transition hover:shadow-lg md:grid-cols-2 ${
                  f.reverse ? "md:[&>*:first-child]:order-2 md:[&>*:last-child]:order-1" : ""
                }`}
              >
                <div className="p-5 sm:p-6">
                  <div className="mb-3 inline-flex rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 p-2 text-blue-700">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.blurb}</p>
                  <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-600">{f.detail}</p>
                </div>
                <motion.div
                  className="bg-gradient-to-br from-[#eef5ff] via-[#f6f8ff] to-[#edf4ff] p-3 sm:p-4"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
                  whileHover={{ y: -8, scale: 1.01 }}
                >
                  <img
                    src={f.image}
                    alt={f.title}
                    className="h-44 w-full rounded-2xl object-cover sm:h-52"
                  />
                </motion.div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div aria-hidden className="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

      <section className="bg-gradient-to-b from-[#f4f3ff] to-[#f2f7ff] py-10 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            {...fadeUp}
            className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-[#f7fbff] to-[#f4f3ff] p-5 shadow-md shadow-blue-100/40 sm:p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">Why sellers stick with CatShare</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Reduce order mistakes",
                "Faster customer replies",
                "Cleaner catalogue sharing",
                "Safer growth with always-online data",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-xl bg-gradient-to-r from-white to-[#edf5ff] px-3 py-2.5 text-sm text-slate-700">
                  <MdCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="border-t border-blue-100 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 py-12 text-center text-white sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">
            Start in 2 Minutes
          </h2>
          <p className="mt-4 text-base text-blue-100 text-pretty sm:text-lg">
            Sign up, add products, share your catalogue, and start taking cleaner orders today.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <motion.div {...softFloat} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition hover:bg-blue-50"
                onClick={() => logWebsiteCtaClicked("final_signup", "website")}
              >
                Get started
              </Link>
            </motion.div>
            <motion.div {...softFloat} transition={{ ...softFloat.transition, delay: 0.4 }} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-white/40 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
                onClick={() => logWebsiteCtaClicked("final_login", "website")}
              >
                I already have an account
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mobile sticky conversion CTA */}
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-blue-100 bg-gradient-to-r from-white/95 via-[#f5f8ff]/95 to-[#edf4ff]/95 px-3 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Link
            to="/register"
            className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-sm font-bold text-white"
            onClick={() => logWebsiteCtaClicked("sticky_signup", "website")}
          >
            Sign up free
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700"
            onClick={() => logWebsiteCtaClicked("sticky_login", "website")}
          >
            Log in
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-slate-400 sm:py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-4 sm:flex-row sm:gap-6 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/CatShare_logo.png" alt="" className="h-8 w-auto opacity-90" />
            <span className="font-semibold text-slate-200">CatShare</span>
          </div>
          <nav
            className="flex w-full max-w-sm flex-col items-stretch gap-1 text-sm sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-end sm:gap-x-6 sm:gap-y-2"
            aria-label="Footer"
          >
            <Link to="/login" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1" onClick={() => logWebsiteCtaClicked("footer_login", "website")}>
              Log in
            </Link>
            <Link to="/register" className="min-h-11 inline-flex items-center justify-center rounded-lg hover:text-white sm:min-h-0 sm:inline sm:py-1" onClick={() => logWebsiteCtaClicked("footer_signup", "website")}>
              Sign up
            </Link>
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
