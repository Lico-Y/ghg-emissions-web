<script>
    import * as d3 from "d3";
    import { onMount, tick } from "svelte";
    import { getSectorDisplayName } from "./utils/sectorLabels.js";

    let container;
    let data = $state([]);
    let selectedYear = $state(2009);
    let selectedSector = $state(null);
    let tooltip = $state(null);
    let error = $state("");
    let scrollSection;

    const topFive = [
        "Transportation and Storage",
        "Agriculture, Forestry and Fishing",
        "Household Activities",
        "Electricity, Gas, Steam and Air Conditioning Supply",
        "Manufacturing"
    ];

    const otherSector = "Other Sectors";
    const categories = [...topFive, otherSector];

    // New palette, separate from the earlier sector chart.
    const sectorColors = {
        "Transportation and Storage": "#367D83",
        "Agriculture, Forestry and Fishing": "#D7A34B",
        "Household Activities": "#B76D58",
        "Electricity, Gas, Steam and Air Conditioning Supply": "#7A86B2",
        "Manufacturing": "#8B6B91",
        "Other Sectors": "#B8C1BC"
    };

    const formatNumber = d3.format(",.0f");
    const formatPercent = d3.format(".1f");

    const years = d3.range(2009, 2025);

    onMount(async () => {
        try {
            const rows = await d3.csv("/data/ghg_by_sector.csv");

            const filtered = rows
                .filter(d =>
                    d["Greenhouse Gas"] ===
                    "Total greenhouse gases in CO2 equivalent (GHG)"
                )
                .map(d => ({
                    year: +d["Year"],
                    sector: String(d["Sector Classification"] ?? "").trim(),
                    emissions: +d["Emissions (kilotonnes)"]
                }))
                .filter(d =>
                    years.includes(d.year) &&
                    d.sector !== "" &&
                    d.sector !== "N/A" &&
                    Number.isFinite(d.emissions)
                );

            if (!filtered.length) {
                throw new Error("No matching greenhouse gas data found.");
            }

            const totals = d3.rollup(
                filtered,
                values => d3.sum(values, d => d.emissions),
                d => d.year,
                d => d.sector
            );

            data = years.map(year => {
                const sectorTotals = totals.get(year) ?? new Map();

                const values = topFive.map(sector => ({
                    sector,
                    emissions: sectorTotals.get(sector) ?? 0
                }));

                const otherEmissions = d3.sum(
                    Array.from(sectorTotals),
                    ([sector, emissions]) =>
                        topFive.includes(sector) ? 0 : emissions
                );

                values.push({
                    sector: otherSector,
                    emissions: otherEmissions
                });

                const total = d3.sum(values, d => d.emissions);

                const ranked = [...values]
                    .filter(d => d.sector !== otherSector)
                    .sort((a, b) => b.emissions - a.emissions);

                return {
                    year,
                    total,
                    values: values.map(d => ({
                        ...d,
                        share: total > 0
                            ? (d.emissions / total) * 100
                            : 0,
                        rank: d.sector === otherSector
                            ? null
                            : ranked.findIndex(
                                item => item.sector === d.sector
                            ) + 1
                    }))
                };
            });

            drawChart();
        } catch (err) {
            error = err.message;
        }
    });

        function handleScroll() {
    if (!scrollSection || !data.length) return;

    const rect = scrollSection.getBoundingClientRect();
    const scrollableDistance = rect.height - window.innerHeight;

    if (scrollableDistance <= 0) return;

    const progress = Math.max(
        0,
        Math.min(1, -rect.top / scrollableDistance)
    );

    const year = 2009 + Math.round(progress * 15);

    if (year !== selectedYear) {
        changeYear(year);
    }
    }
    function drawChart() {
        if (!container || !data.length) return;

        d3.select(container).selectAll("*").remove();

        const width = 1000;
        const height = 650;
        const margin = {
            top: 35,
            right: 30,
            bottom: 65,
            left: 95
        };

        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr(
                "aria-label",
                "Stacked bar chart of greenhouse gas emissions by sector, 2009 to 2024"
            );

        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.total) * 1.08])
            .nice()
            .range([margin.left, width - margin.right]);
            
        const y = d3.scaleBand()
            .domain(years)
            .range([margin.top, height - margin.bottom])
            .paddingInner(0.3);

        // Y-axis: Years (2009–2024)
        const yAxis = svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(
                d3.axisLeft(y)
                    .tickSize(0)
            )
            .call(g => g.select(".domain").remove());

        yAxis.selectAll("text")
            .attr("font-size", 13)
            .attr("font-weight", 600)
            .attr("dx", -8);

        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(
                d3.axisBottom(x)
                    .ticks(6)
                    .tickFormat(d3.format(","))
            );

        xAxis.selectAll("text")
            .attr("font-size", 13);

        svg.append("text")
            .attr("x", width/2)
            .attr("y", height - 12)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .text("Total emissions (kt CO₂e)")
            .attr("font-weight", "bold");

        svg.append("g")
            .selectAll("line")
            .data(x.ticks(6))
            .join("line")
            .attr("x1", d => x(d))
            .attr("x2", d => x(d))
            .attr("y1", margin.top)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "currentColor")
            .attr("stroke-opacity", 0.1);

        const barsGroup = svg.append("g")
            .attr("class", "bars");

        function update() {
            const visible = data.filter(d => d.year <= selectedYear);

            const segments = visible.flatMap(yearData => {
                const other = yearData.values.find(
                    d => d.sector === otherSector
                );

                const ranked = yearData.values
                    .filter(d => d.sector !== otherSector)
                    .sort((a, b) => b.emissions - a.emissions);

                // largest to smallest sector
                const ordered = [...ranked, other];

                let cumulative = 0;

                return ordered.map(d => {
                    const start = cumulative;
                    cumulative += d.emissions;

                    return {
                        ...d,
                        year: yearData.year,
                        y0: start,
                        y1: cumulative
                    };
                });
            });

            barsGroup.selectAll("rect")
                .data(segments, d => `${d.year}-${d.sector}`)
                .join(
                    enter => enter.append("rect")
                        .attr("x", d => x(d.y0))
                        .attr("y", d => y(d.year))
                        .attr("width", d => Math.max(0, x(d.y1) - x(d.y0)))
                        .attr("height", y.bandwidth())
                        .attr("fill", d => sectorColors[d.sector])
                        .attr("cursor", "pointer")
                        .attr("opacity", 0)
                        .on("mouseenter", (event, d) => {
                            tooltip = {
                                sector: getSectorDisplayName(d.sector),
                                year: d.year,
                                emissions: d.emissions,
                                share: d.share,
                                rank: d.rank
                            };
                        })
                        .on("mouseleave", () => {
                            tooltip = null;
                        })
                        .on("click", (event, d) => {
                            selectedSector =
                                selectedSector === d.sector ? null : d.sector;
                            update();
                        })
                        .call(enter => enter.transition()
                            .duration(350)
                            .attr("opacity", 1)),
                    update => update,
                    exit => exit.remove()
                )
                .attr("opacity", d =>
                    selectedSector === null || selectedSector === d.sector
                        ? 1
                        : 0.2
            );
        }
        // Keep a reference for slider and legend updates.
        updateChart = update;
        update();
    }

    let updateChart = () => {};

    function changeYear(value) {
        selectedYear = +value;
        tooltip = null;
        updateChart();
    }

    function toggleSector(sector) {
        selectedSector =
            selectedSector === sector ? null : sector;
        updateChart();
    }
</script>

<svelte:window onscroll={handleScroll} />

<section id="sector-breakdown" bind:this={scrollSection}>
    <div class="sticky-content">
        <div class="section-intro">
            <div class="section-divider"></div>
            <p class="section-label">
                04 / THE SECTORS BEHIND THE NUMBERS
            </p>

            <h2>
                Which economic sectors contribute the most,
                and how have their emissions changed over time?
            </h2>
        </div>
        <div class="visualization-layout">

            <!-- Chart and legend -->
            <div class="chart-wrapper">
                <div class="chart-container" bind:this={container}></div>

                {#if tooltip}
                    <div class="tooltip">
                        <strong>{tooltip.sector} · {tooltip.year}</strong>

                        <p>
                            Emissions: {formatNumber(tooltip.emissions)} kt CO₂e
                        </p>

                        <p>
                            Share: {formatPercent(tooltip.share)}%
                        </p>

                        {#if tooltip.rank !== null}
                            <p>Annual rank: #{tooltip.rank}</p>
                        {/if}
                    </div>
                {/if}

                <div class="sector-legend">
                    {#each categories as sector}
                        <button
                            type="button"
                            class:inactive={selectedSector !== null && selectedSector !== sector}
                            onclick={() => toggleSector(sector)}
                        >
                            <span
                                class="legend-swatch"
                                style:background={sectorColors[sector]}
                            ></span>

                            {getSectorDisplayName(sector)}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Vertical year slider -->
            <div class="chart-controls">
                <span class="slider-year">{selectedYear}</span>

                <span class="slider-endpoint">2009</span>

                <input
                    id="year-slider"
                    aria-label="Select year"
                    type="range"
                    min="2009"
                    max="2024"
                    step="1"
                    value={selectedYear}
                    oninput={event => changeYear(event.currentTarget.value)}
                />

                <span class="slider-endpoint">2024</span>
            </div>

        </div>
    </div>

    {#if error}
        <p class="error">{error}</p>
    {/if}
</section>


<style>
    #sector-breakdown {
        position: relative;
        min-height: 350vh;
        padding: 20px 60px;
        box-sizing: border-box;
    }

    .section-intro {
        max-width: 950px;
        margin: 0 auto 8px;
        text-align: center;
    }
    .section-intro h2 {
        margin-bottom: 0;
        font-weight: bold;
        max-width: 700px; 
        margin: 0 auto;  
        font-size: 26px;
    }

    h2 {
        font-size: clamp(28px, 3.5vw, 48px);
        line-height: 1.2;
    }

    .chart-controls {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        height: 650px;
        margin: 0;
    }

    .slider-year {
        font-size: 20px;
        font-weight: 700;
        color: var(--accent);
    }

    .chart-controls input[type="range"] {
        writing-mode: vertical-lr;
        direction: ltr;
        appearance: slider-vertical;
        width: 20px;
        height: 520px;
        accent-color: var(--accent);
        cursor: pointer;
    }


    .sector-legend {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        column-gap: 16px;
        row-gap: 6px;
        margin: 4px auto 0;
        padding: 0;
        max-width: 100%;
    }

    .sector-legend button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 3px;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        white-space: nowrap;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .sector-legend button.inactive {
        opacity: 0.35;
    }

    .legend-swatch {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        flex-shrink: 0;
    }

    .chart-wrapper {
        position: relative;
        width: 100%;
        max-width: 1000px;
        min-width: 0;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 12px 16px 8px;
        border: 1px solid #dddddd;
        border-radius: 14px;
        background: #ffffff;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
    }

    .chart-container {
        width: 100%;
    }

    .chart-container :global(svg) {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
    }

    .tooltip {
        position: absolute;
        top: 12px;
        right: 12px;
        z-index: 10;
        padding: 8px 12px;
        border-radius: 6px;
        background: #ffffff;
        border: 1px solid #dddddd;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
        pointer-events: none;
        font-size: 12px;
        line-height: 1.4;
        max-width: 240px;
    }

    .tooltip p {
        margin: 3px 0 0;
        font-size: 12px;
        line-height: 1.4;
    }

    .error {
        color: #b42318;
        text-align: center;
    }

    @media (max-width: 800px) {
        #sector-breakdown {
            padding: 60px 16px;
        }

        .chart-wrapper {
            padding: 10px;
        }
    }
   .visualization-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 75px;
        align-items: center;
        gap: 25px;
        width: 100%;
        max-width: 1150px;
        margin: 0 auto;
    }

    .slider-endpoint {
    font-size: 13px;
    color: var(--text-muted);
    }

    .sticky-content {
        position: sticky;
        top: 0;
        min-height: 100vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

</style>
