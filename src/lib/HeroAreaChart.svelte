<script>
    import * as d3 from 'd3';
    import { onMount } from 'svelte';

    let data = $state([]);
    let hovered = $state(null);

    onMount(async () => {
        data = await d3.csv('/data/annual_total_emissions.csv', d => ({
            year: +d["Year"],
            emissions: +d["Emissions (kilotonnes)"]
        }));
    });

    const width = 900;
    const height = 300;
    const margin = {
        top: 20,
        right: 20,
        bottom: 40,
        left: 60
    };

    const xScale = d3.scaleLinear()
        .domain([2009, 2024])
        .range([margin.left, width-margin.right]);

    const yScale = d3.scaleLinear()
            .domain([0, 80000])
            .range([height - margin.bottom, margin.top]);

    const linePath = $derived(
        d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.emissions))
            (data)
    );
    
    const areaPath = $derived(
        d3.area()
            .x(d => xScale(d.year))
            .y0(height - margin.bottom)
            .y1(d => yScale(d.emissions))
            (data)
    );

    function drawXAxis(node) {
        const axis = d3.axisBottom(xScale)
            .tickFormat(d3.format("d"))
            .tickValues(d3.range(2009, 2025));
        d3.select(node).call(axis);
    }

    function drawYAxis(node) {
        const axis = d3.axisLeft(yScale)
            .tickValues(d3.range(0, 80001, 10000))
            .tickFormat(d => d % 20000 === 0 ? d3.format(",")(d) : "");

        const selection = d3.select(node).call(axis);

        selection.selectAll(".tick line")
            .attr("x2", d => d % 20000 === 0 ? -8 : -4);
        selection.select(".domain")
            .attr("d", `M0,${yScale(80000)}V${yScale(0)}`);
    }

    function handlePointerMove(event) {
    const [mouseX] = d3.pointer(event, event.currentTarget);

    const year = xScale.invert(mouseX);

    hovered = d3.least(
        data,
        d => Math.abs(d.year - year)
    );
    }
</script>

{#if data.length > 0}
    <svg viewBox="0 0 900 300" 
    role="img" 
    aria-label="Ireland's annual greenhouse gas emissions from 2009 to 2024"
    onpointermove={handlePointerMove}
    onpointerleave={() => hovered = null}>
        <path
            d={areaPath}
            fill="var(--accent)"
            opacity="0.4"
        />
        <text
            x={width / 2}
            y={160}
            text-anchor="middle"
            fill="var(--text)"
            font-size="18"
            font-family="var(--heading)"
            font-weight="500"
            pointer-events="none"
        >
            Annual Greenhouse Gas Emissions (2009–2024)
        </text>
        <text
            x={width / 2}
            y={180}
            text-anchor="middle"
            fill="var(--text-muted)"
            font-size="14"
            pointer-events="none"
        >
            Measured in kilotonnes of CO₂ equivalent (kt CO₂e)
        </text>

        <path
            d={linePath}
            fill="none"
            stroke="var(--text)"
            stroke-width="3"
        />
        {#each data as d (d.year)}
            <circle
            cx={xScale(d.year)}
            cy={yScale(d.emissions)}
            r="3"
            fill="var(--text)"
            />
        {/each}

        {#if hovered}
            <line
                x1={xScale(hovered.year)}
                x2={xScale(hovered.year)}
                y1={margin.top}
                y2={height - margin.bottom}
                stroke="var(--text-muted)"
                stroke-dasharray="4 4"
                pointer-events="none"
                stroke-width="2"
            />
            <line
                x1={margin.left}
                x2={width - margin.right}
                y1={yScale(hovered.emissions)}
                y2={yScale(hovered.emissions)}
                stroke="var(--text-muted)"
                stroke-dasharray="4 4"
                pointer-events="none"
                stroke-width="2"
            />
            <circle
                cx={xScale(hovered.year)}
                cy={yScale(hovered.emissions)}
                r="6"
                fill="var(--text)"
                stroke="white"
                stroke-width="2"
                pointer-events="none"
            />

            <g
                class="tooltip"
                transform={`translate(${xScale(hovered.year) + 12}, ${yScale(hovered.emissions) - 65})`}
                pointer-events="none"
            >
                <rect
                    width="100"
                    height="45"
                    rx="6"
                    fill="var(--text)"
                />

                <text x="5" y="16" fill="white" font-size="14" font-weight="bold">
                    {hovered.year}
                </text>

                <text x="5" y="36" fill="white" font-size="13">
                    {d3.format(",.0f")(hovered.emissions)} kt CO₂e
                </text>
            </g>
        {/if}

        <g class="axis x-axis"
            transform={`translate(0, ${height - margin.bottom})`}
            use:drawXAxis
        ></g>
        <g class="axis y-axis"
            transform={`translate(${margin.left}, 0)`}
            use:drawYAxis
        ></g>
    </svg>
{:else}
    <p>Loading emissions data...</p>
{/if}

<style>
    svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
    }
    :global(.axis text) {
        fill: var(--text-muted);
        opacity: 0.7;
        font-size: 12px;
    }

    :global(.axis path) {
        stroke: var(--text-muted);
        opacity: 0.7;
    }
    :global(.axis line) {
        stroke: var(--text-muted);
        opacity: 0.7;
    }


</style>
