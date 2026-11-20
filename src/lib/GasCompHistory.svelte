
<script>
    import { onMount } from "svelte";
    import * as d3 from "d3";

    let container;
    let tooltip = $state(null);
    let error = $state("");

    const csvPath = `${import.meta.env.BASE_URL}data/ghg_by_sector.csv`;

    const gases = [
        { name: "CO₂", key: "CO2", color: "#44c0c0ca" },
        { name: "CH₄", key: "CH4", color: "#579499c3" },
        { name: "N₂O", key: "N2O", color: "#f9a01cc1" },
        { name: "HFCs", key: "HFCs", color: "#304169b9" },
        { name: "PFCs", key: "PFCs", color: "#7b7979" },
        { name: "SF₆ / NF₃", key: "SF6 & NF3", color: "#cec442" }
    ];

    const width = 1000;
    const margin = { top: 28, right: 85, bottom: 40, left: 115 };
    const rowHeight = 125;
    const plotHeight = 88;
    const height = margin.top + gases.length * rowHeight + margin.bottom;
    const plotWidth = width - margin.left - margin.right;

    const x = d3.scaleLinear()
        .domain([2009, 2024])
        .range([margin.left, width - margin.right]);

    // One identical scale for every gas panel.
    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([plotHeight, 0]);

    const formatShare = d3.format(".2f");
    const formatEmissions = d3.format(",.0f");

    function getRowData(rows) {
        // Keep individual gases, excluding CO2-equivalent total rows.
        const parsed = rows
            .map(row => ({
                year: +row["Year"],
                gas: String(row["Gas Type"] ?? "").trim(),
                emissions: +row["Emissions (kilotonnes)"]
            }))
            .filter(row =>
                Number.isFinite(row.year) &&
                Number.isFinite(row.emissions) &&
                row.year >= 2009 &&
                row.year <= 2024 &&
                gases.some(g => g.key === row.gas)
            );

        // Sum emissions across sectors for each year and gas.
        const annualGasTotals = d3.rollup(
            parsed,
            values => d3.sum(values, d => d.emissions),
            d => d.year,
            d => d.gas
        );

        // Total emissions across all six gases for each year.
        const annualTotals = d3.rollup(
            parsed,
            values => d3.sum(values, d => d.emissions),
            d => d.year
        );

        return gases.map(gas => ({
            ...gas,
            values: Array.from(annualGasTotals, ([year, gasMap]) => {
                const emissions = gasMap.get(gas.key);

                if (emissions === undefined) return null;

                return {
                    year,
                    emissions,
                    share: (emissions / annualTotals.get(year)) * 100
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.year - b.year)
        }));
    }

    function draw(data) {
        const root = d3.select(container);
        root.selectAll("svg").remove();

        const svg = root.append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("role", "img")
            .attr(
                "aria-label",
                "Six line charts showing annual greenhouse gas percentage composition from 2009 to 2024"
            );

        data.forEach((gas, index) => {
            const top = margin.top + index * rowHeight;

            const panel = svg.append("g")
                .attr("transform", `translate(0, ${top})`);

            panel.append("text")
                .attr("x", 10)
                .attr("y", plotHeight / 2)
                .attr("dominant-baseline", "middle")
                .attr("font-size", 16)
                .attr("font-weight", 600)
                .attr("fill", gas.color)
                .text(gas.name);
  
            panel.append("g")
                .attr("transform", `translate(${margin.left}, 0)`)
                .call(
                    d3.axisLeft(y)
                        .tickValues([0, 25, 50, 75, 100])
                        .tickFormat(d => `${d}%`)
                        .tickSize(5)
                )
                .call(g => g.select(".domain")
                    .attr("stroke", "currentColor")
                    .attr("stroke-opacity", 0.65))
                .call(g => g.selectAll(".tick line")
                    .attr("stroke", "currentColor")
                    .attr("stroke-opacity", 0.5))
                .call(g => g.selectAll("text")
                    .attr("fill", "currentColor")
                    .attr("font-size", 12)
                    .attr("dx", -5));


            panel.append("g")
                .attr("transform", `translate(${margin.left}, 0)`)
                .call(
                    d3.axisLeft(y)
                        .tickValues([0, 25, 50, 75, 100])
                        .tickSize(-plotWidth)
                        .tickFormat("")
                )
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll("line")
                    .attr("stroke", "currentColor")
                    .attr("stroke-opacity", 0.08));


            const meanShare = d3.mean(gas.values, d => d.share);

            panel.append("line")
                .attr("x1", margin.left)
                .attr("x2", width - margin.right + 20)
                .attr("y1", y(meanShare))
                .attr("y2", y(meanShare))
                .attr("stroke", "#899d90")
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "6 5")
                .attr("stroke-opacity", 0.85);

            panel.selectAll(".data-point")
                .data(gas.values)
                .join("circle")
                .attr("class", "data-point")
                .attr("cx", d => x(d.year))
                .attr("cy", d => y(d.share))
                .attr("r", 5.5)
                .attr("fill", gas.color)
                .attr("stroke", "white")
                .attr("stroke-width", 1)
                .on("mouseenter", (event, d) => {
                    tooltip = {
                        gas: gas.name,
                        year: d.year,
                        share: d.share,
                        emissions: d.emissions,
                        color: gas.color
                    };
                })
                .on("mouseleave", () => {
                    tooltip = null;
                });
            panel.append("text")
                .attr("x", width - margin.right + 25)
                .attr("y", y(meanShare))
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .attr("font-size", 13)
                .attr("font-weight", 600)
                .attr("fill", "#777777")
                .text(`${meanShare.toFixed(2)}%`);
        });

        // One X-axis, at the bottom of the full visualization.
        const bottomY =
            margin.top + (gases.length - 1) * rowHeight + plotHeight;

        svg.append("g")
            .attr("transform", `translate(0, ${bottomY})`)
            .call(
                d3.axisBottom(x)
                    .tickValues([2009, 2012, 2015, 2018, 2021, 2024])
                    .tickFormat(d3.format("d"))
                    .tickSizeOuter(0)
            )
            .call(g => g.selectAll("text")
                .attr("fill", "currentColor")
                .attr("font-size", 14))
            .call(g => g.select(".domain")
                .attr("stroke", "currentColor")
                .attr("stroke-opacity", 0.5));

        svg.append("text")
            .attr("x", margin.left + plotWidth / 2)
            .attr("y", height - 45)
            .attr("text-anchor", "middle")
            .attr("font-size", 18)
            .attr("font-weight", "bold")
            .attr("fill", "currentColor")
            .text("Year");
    }

    onMount(async () => {
        try {
            const rows = await d3.csv(csvPath);
            const data = getRowData(rows);

            if (data.some(gas => gas.values.length === 0)) {
                error = "Some gas categories were not found. Check the CSV gas names.";
                return;
            }

            draw(data);
        } catch (err) {
            console.error(err);
            error = "Unable to load the annual greenhouse gas dataset.";
        }
    });
</script>

<section id="gas-share-history">
    <div class="section-intro">
        <div class="section-divider"></div>
        <p class="section-label">03 / BEYOND A SINGLE YEAR</p>

        <h2>
            Are the patterns we observed in 2024
            consistent across the other years in our dataset?
        </h2>
    </div>

    <div class="history-layout">
        <div class="history-chart">
            <div class="chart-wrapper">
                <div class="chart-container" bind:this={container}></div>

                {#if tooltip}
                    <div class="tooltip">
                        <strong style:color={tooltip.color}>
                            {tooltip.gas} • {tooltip.year}
                        </strong>
                        <p>
                            Share: {formatShare(tooltip.share)}%
                        </p>
                        <p>
                            Emissions: {formatEmissions(tooltip.emissions)}
                            kt CO₂e
                        </p>
                    </div>
                {/if}
                <div class="mean-legend">
                    <span class="mean-line"></span>
                    <span>Mean annual share (2009–2024)</span>
                </div>
            </div>

            {#if error}
                <p class="error">{error}</p>
            {/if}
        </div>

        <div class="history-explanation">
            <div class="stability-summary">
                <p>
                    The composition of greenhouse gases remained
                    <strong class="highlight-stat">relatively consistent</strong>
                    from 2009 to 2024. On average,
                    <strong class="highlight-stat">CO₂ accounted for approximately 70%</strong>
                    of annual greenhouse gas emissions, followed by
                    <strong class="highlight-stat">CH₄ at 21.2%</strong>.
                    <strong class="highlight-stat">HFCs, PFCs, and SF₆ &amp; NF₃</strong>
                    combined contributed less than <strong class="highlight-stat">2%</strong>
                    of annual emissions.
                </p>
            </div>
        </div>
    </div>
</section>

<style>
    #gas-share-history {
        min-height: 0;
        padding: 20px 60px 40px;
        box-sizing: border-box;
    }

    .section-intro {
        max-width: 900px;
        margin: 0 auto 20px;
        text-align: center;
    }

    h2 {
        font-weight: bold;
        max-width: 700px;
        margin: 0 auto 40px;
    }

    /* Chart and explanation stacked vertically */
    .history-layout {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 35px;
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
    }

    /* Larger chart area */
    .history-chart {
        width: 100%;
        min-width: 0;
    }

    .chart-wrapper {
        position: relative;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        box-sizing: border-box;

        background: #ffffff;
        border: 1px solid #dddddd;
        border-radius: 14px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.09);
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

    /* Explanation below the graph */
    .history-explanation {
        width: 100%;
        max-width: 850px;
        min-width: 0;
        margin: 0 auto;
        text-align: center;
    }

    .stability-summary {
        width: 100%;
        margin: 0;
        line-height: 1.7;
    }

    .highlight-stat {
        color: var(--accent);
        font-weight: 550;
    }

    /* Mean reference line legend */
    .mean-legend {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        margin-top: 0;
        font-size: 8px;
        color: var(--text-muted);
    }

    .mean-line {
        width: 32px;
        border-top: 1px dashed #888888;
    }

    /* Hover tooltip */
    .tooltip {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 10;
        padding: 8px 12px;
        border-radius: 8px;
        background: var(--background, #ffffff);
        border: 1px solid #d5d5d5;
        box-shadow: 0 3px 10px #00000018;
        pointer-events: none;
        font-size: 10px;
        width: max-content;
        max-width: 220px;
    }

    .tooltip p {
        margin: 3px 0 0;
        font-size: 8px;
    }

    .error {
        color: #b42318;
        text-align: center;
    }

    /* Responsive layout */
    @media (max-width: 800px) {
        #gas-share-history {
            padding: 20px 16px 40px;
        }

        .history-layout {
            gap: 25px;
        }

        .chart-wrapper {
            padding: 12px;
        }

        .history-explanation {
            max-width: 100%;
        }
    }
</style>
