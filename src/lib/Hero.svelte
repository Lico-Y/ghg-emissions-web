
<script>
    import AreaChart from "./HeroAreaChart.svelte";
</script>

<section id="landing">
    <div class="intro">
        <p class="eyebrow">SOURCE: CENTRAL STATISTICS OFFICE · EAA17</p>

        <h1>Ireland's Greenhouse Gas Emissions by Economic Sector</h1>
        <h3>
            Exploring emissions by resident units
            of the Irish economy across sectors,
            2009–2024.
        </h3>

        <div class="section-divider"></div>
        <p class="section-label">
            01 / THE BIG PICTURE
        </p>
    </div>

    <div id="hero-area-chart">
        <AreaChart />
    </div>

    <p class="emissions-summary">
        Between 2009 and 2024, annual greenhouse gas emissions
        increased by about <strong>4%</strong>, representing an additional
        <strong>2,816 kilotonnes of CO₂ equivalent</strong>.
    </p>
</section>

<style>
    #landing {
        min-height: 100vh;
        padding: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0px;
        box-sizing: border-box;
    }

    .intro {
        max-width: 900px;
        margin-inline: auto;
        text-align: center;
    }

    .eyebrow {
        position: absolute;
        top: 5px;
        left: 20px;
        font-size: 14px;
        font-weight: bold;
        color: var(--text-muted);
    }

    #hero-area-chart {
        width: 100%;
        min-height: 40vh;
        background: transparent;
        border-radius: 12px;
    }

    .emissions-summary {
        max-width: 800px;
        margin: 20px auto;
        text-align: center;
        line-height: 1.6;
    }
</style>

