import './landing.css';
import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
    ArrowRight,
    BookOpen,
    BrainCircuit,
    ToggleRight,
    FlaskConical,
    Cpu,
    Github,
    ExternalLink,
} from 'lucide-react';

const MathWireframe = lazy(() => import('./MathWireframe'));

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: i * 0.08, ease: EASE },
    }),
} as const;

const cardReveal = {
    hidden: { opacity: 0, y: 40, scale: 0.97 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.55, delay: i * 0.1, ease: EASE },
    }),
} as const;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAV_LINKS = [
    { label: 'IDE', hash: '#ide' },
    { label: 'Playground', hash: '#playground' },
    { label: 'API', hash: '#api' },
    { label: 'Docs', href: 'https://github.com/adamouksili/theoremis#readme' },
];

const FEATURES = [
    {
        icon: Cpu,
        title: 'Lean 4 First',
        description:
            'Deep integration with the Lean 4 toolchain. Auto-generated imports, live verification through a local or remote Lean bridge, and Mathlib-aware search.',
        tag: 'Core',
    },
    {
        icon: BrainCircuit,
        title: 'AI-Assisted Proofs',
        description:
            'Goal-aware LLM tactic suggestions with confidence scores. Supports OpenAI, Anthropic, and GitHub Models — bring your own key.',
        tag: 'AI',
    },
    {
        icon: ToggleRight,
        title: 'Axiom Budget Tracking',
        description:
            'Toggle Classical logic, Choice, and Function Extensionality. See exactly which axioms each proof depends on — no hidden assumptions.',
        tag: 'Rigor',
    },
    {
        icon: FlaskConical,
        title: 'Hypothesis Testing',
        description:
            'Mutation analysis detects unnecessary hypotheses. QuickCheck-style random testing catches counterexamples before you waste time proving false statements.',
        tag: 'Testing',
    },
];

const CODE_LINES = [
    { text: 'theorem add_comm (n m : \\u2115) :', color: 'text-text-primary' },
    { text: '    n + m = m + n := by', color: 'text-text-primary' },
    { text: '  induction n with', color: 'text-accent-glow' },
    { text: '  | zero => simp', color: 'text-accent-glow' },
    { text: '  | succ n ih =>', color: 'text-accent-glow' },
    { text: '    simp [Nat.succ_add, ih]', color: 'text-accent-glow' },
    { text: '-- \\u2713 verified via Lean bridge', color: 'text-green-500' },
];

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
                scrolled
                    ? 'bg-black/60 backdrop-blur-xl border-b border-border'
                    : 'bg-transparent'
            }`}
        >
            <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <a href="#" className="flex items-center gap-2 group">
                    <div className="w-7 h-7 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center group-hover:bg-accent/25 transition-colors">
                        <span className="text-accent-glow font-mono text-xs font-bold">&lambda;</span>
                    </div>
                    <span className="text-text-primary font-semibold tracking-tight text-[15px]">
                        Theoremis
                    </span>
                </a>

                {/* Center links */}
                <div className="hidden md:flex items-center gap-1">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.label}
                            href={link.hash ?? link.href}
                            target={link.href ? '_blank' : undefined}
                            rel={link.href ? 'noopener noreferrer' : undefined}
                            className="px-3 py-1.5 text-[13px] text-text-secondary hover:text-text-primary rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                {/* Right */}
                <div className="flex items-center gap-3">
                    <a
                        href="https://github.com/adamouksili/theoremis"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-text-secondary transition-colors"
                        aria-label="GitHub"
                    >
                        <Github size={18} />
                    </a>
                    <a
                        href="#ide"
                        className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-text-primary bg-white/[0.06] hover:bg-white/[0.1] border border-border rounded-lg transition-colors"
                    >
                        Open IDE
                    </a>
                </div>
            </div>
        </motion.nav>
    );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
    const { scrollYProgress } = useScroll();
    const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
            {/* 3D Background */}
            <Suspense fallback={null}>
                <MathWireframe />
            </Suspense>

            {/* Radial glow */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full z-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                }}
            />

            <motion.div
                style={{ opacity: heroOpacity, y: heroY }}
                className="relative z-10 max-w-4xl mx-auto px-6 text-center"
            >
                {/* Badge */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                    className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-border bg-white/[0.03] backdrop-blur-sm"
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[12px] text-text-secondary font-medium tracking-wide">
                        Open-source &middot; MIT License
                    </span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                    className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-text-primary leading-[1.08]"
                >
                    Write math.
                    <br />
                    <span className="bg-gradient-to-r from-accent-glow via-accent to-accent-dim bg-clip-text text-transparent">
                        Verify in Lean 4.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={2}
                    className="mt-6 text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto"
                >
                    Parse LaTeX, detect unnecessary hypotheses via mutation testing,
                    and verify proofs through a live Lean bridge — all from your browser.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={3}
                    className="flex items-center justify-center gap-4 mt-10"
                >
                    <a
                        href="#ide"
                        className="group relative inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl bg-accent hover:bg-accent-glow transition-all duration-300 shadow-[0_0_24px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                    >
                        Start Free
                        <ArrowRight
                            size={16}
                            className="group-hover:translate-x-0.5 transition-transform"
                        />
                    </a>
                    <a
                        href="https://github.com/adamouksili/theoremis#readme"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-white/[0.15] rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 backdrop-blur-sm"
                    >
                        <BookOpen size={16} />
                        Read the Docs
                    </a>
                </motion.div>

                {/* Code preview */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={4}
                    className="mt-16 max-w-lg mx-auto"
                >
                    <div className="rounded-xl border border-border bg-surface-raised/80 backdrop-blur-xl overflow-hidden shadow-2xl">
                        {/* Title bar */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                            <div className="flex gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                            </div>
                            <span className="text-[11px] text-text-muted font-mono ml-2">
                                add_comm.lean
                            </span>
                        </div>
                        {/* Code */}
                        <div className="px-4 py-3 font-mono text-[13px] leading-6 text-left">
                            {CODE_LINES.map((line, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        duration: 0.3,
                                        delay: 1.0 + i * 0.12,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                    className={line.color}
                                >
                                    {line.text}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5, duration: 1 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
            >
                <div className="w-5 h-8 rounded-full border border-border flex justify-center pt-1.5">
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-1 h-1 rounded-full bg-text-muted"
                    />
                </div>
            </motion.div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

function FeatureCard({
    feature,
    index,
}: {
    feature: (typeof FEATURES)[number];
    index: number;
}) {
    const Icon = feature.icon;

    return (
        <motion.div
            variants={cardReveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            custom={index}
            className="group relative rounded-xl border border-border bg-white/[0.02] backdrop-blur-sm p-6 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-500"
        >
            {/* Hover glow */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative">
                {/* Tag */}
                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase text-accent-glow/70 bg-accent/10 rounded mb-4">
                    {feature.tag}
                </span>

                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/15 transition-colors">
                    <Icon size={20} className="text-accent-glow" />
                </div>

                <h3 className="text-base font-semibold text-text-primary mb-2">
                    {feature.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                </p>
            </div>
        </motion.div>
    );
}

function Features() {
    return (
        <section className="relative py-32 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Section header */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    custom={0}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
                        Built for formal verification
                    </h2>
                    <p className="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
                        Every feature designed for mathematicians who demand rigor,
                        researchers who need speed, and students learning proof assistants.
                    </p>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {FEATURES.map((feature, i) => (
                        <FeatureCard key={feature.title} feature={feature} index={i} />
                    ))}
                </div>
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Pipeline section
// ---------------------------------------------------------------------------

function Pipeline() {
    const steps = [
        { num: '01', label: 'Parse', desc: 'LaTeX / natural math input' },
        { num: '02', label: 'Translate', desc: 'Type-theoretic IR (\u03bbPi\u03c9)' },
        { num: '03', label: 'Emit', desc: 'Lean 4 code generation' },
        { num: '04', label: 'Verify', desc: 'Live Lean bridge check' },
    ];

    return (
        <section className="relative py-24 px-6">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    custom={0}
                    className="text-center mb-14"
                >
                    <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
                        From LaTeX to verified proof
                    </h2>
                    <p className="mt-4 text-text-secondary text-lg">
                        A four-stage pipeline that bridges informal math and machine-checked verification.
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {steps.map((step, i) => (
                        <motion.div
                            key={step.num}
                            variants={cardReveal}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: '-40px' }}
                            custom={i}
                            className="relative text-center p-5 rounded-xl border border-border bg-white/[0.02]"
                        >
                            <span className="font-mono text-[11px] text-accent-glow/50 tracking-widest">
                                {step.num}
                            </span>
                            <h3 className="text-lg font-semibold text-text-primary mt-1">
                                {step.label}
                            </h3>
                            <p className="text-[13px] text-text-muted mt-1">
                                {step.desc}
                            </p>
                            {i < steps.length - 1 && (
                                <div className="hidden md:block absolute top-1/2 -right-2.5 w-4 text-text-muted">
                                    <ArrowRight size={14} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// CTA
// ---------------------------------------------------------------------------

function BottomCta() {
    return (
        <section className="relative py-28 px-6">
            <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                custom={0}
                className="max-w-2xl mx-auto text-center"
            >
                <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
                    Start proving today
                </h2>
                <p className="mt-4 text-text-secondary text-lg">
                    No install. No signup. Open the IDE and write your first verified proof in Lean 4.
                </p>
                <div className="flex items-center justify-center gap-4 mt-8">
                    <a
                        href="#ide"
                        className="group inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold text-white rounded-xl bg-accent hover:bg-accent-glow transition-all duration-300 shadow-[0_0_24px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                    >
                        Open IDE
                        <ArrowRight
                            size={16}
                            className="group-hover:translate-x-0.5 transition-transform"
                        />
                    </a>
                    <a
                        href="https://github.com/adamouksili/theoremis"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-text-secondary hover:text-text-primary border border-border hover:border-white/[0.15] rounded-xl bg-white/[0.03] transition-all duration-300"
                    >
                        <Github size={16} />
                        Star on GitHub
                        <ExternalLink size={12} />
                    </a>
                </div>
            </motion.div>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
    return (
        <footer className="border-t border-border py-8 px-6">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-text-muted">
                <span>&copy; {new Date().getFullYear()} Theoremis &middot; MIT License</span>
                <div className="flex items-center gap-5">
                    <a href="https://github.com/adamouksili/theoremis" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">
                        GitHub
                    </a>
                    <a href="#api" className="hover:text-text-secondary transition-colors">
                        API
                    </a>
                    <a href="#playground" className="hover:text-text-secondary transition-colors">
                        Playground
                    </a>
                </div>
            </div>
        </footer>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-text-primary antialiased selection:bg-accent/30">
            <Navbar />
            <Hero />
            <Features />
            <Pipeline />
            <BottomCta />
            <Footer />
        </div>
    );
}
