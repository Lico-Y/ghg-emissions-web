<script>
    import Hero from './lib/Hero.svelte';
    import ExplainMetrics from './lib/ExplainMetrics.svelte';
    import GasComposition from "./lib/GasComposition.svelte";
    import GasCompHistory from "./lib/GasCompHistory.svelte";
    import SectorBreakdown from "./lib/SectorBreakdown.svelte";
</script>

<main>
    <!-- 01 / THE BIG PICTURE -->
    <Hero />

    <!-- 02 / INSIDE THE EMISSIONS -->
    <ExplainMetrics />
    <GasComposition />
    <!-- 03 / BEYOND A SINGLE YEAR -->
    <GasCompHistory />
    <!-- 04 / THE SECTORS BEHIND THE NUMBERS -->
    <SectorBreakdown />
</main>

<style>
    main {
        width: 100%;
    }

    .story-transition {
        max-width: 760px;
        margin: 0 auto;
        padding: 70px 30px;
        text-align: center;
    }

    .story-transition p {
        font-family: var(--heading);
        font-size: clamp(22px, 2.5vw, 30px);
        line-height: 1.5;
        color: var(--text);
        margin: 0;
    }

    @media (max-width: 768px) {
        .story-transition {
            padding: 45px 24px;
        }

        .story-transition p {
            font-size: 22px;
        }
    }
</style>
