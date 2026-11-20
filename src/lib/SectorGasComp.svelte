
<script>
    import * as d3 from "d3";
    import { getSectorDisplayName } from "./utils/sectorLabels.js";

    let { sector, data, activeGas, onGasSelect} = $props();

    const gasOrder = [
        "CO2", "CH4", "N2O",
        "HFCs", "PFCs", "SF6 & NF3"
    ];

    let composition = $derived.by(() => {
        const records = data.filter(d => d.sector === sector);

        const total = d3.sum(records, d => d.emissions);

        const gases = gasOrder.map(gas => {
            const emissions = d3.sum(
                records.filter(d => d.gas === gas),
                d => d.emissions
            );

            return {
                gas,
                emissions,
                percentage: total > 0
                    ? emissions / total * 100
                    : 0
            };
        });

        return {
            name: sector,
            total,
            gases
        };
    });
    let stackedSegments = $derived.by(() => {
        let cumulative = 0;

        return composition.gases.map(d => {
            const segment = {
                ...d,
                start: cumulative,
                end: cumulative + d.percentage
            };

            cumulative = segment.end;
            return segment;
        });
    });

    const gasColors = {
    CO2: "#44c0c0ca",
    CH4: "#579499c3",
    N2O: "#f9a01cc1",
    HFCs: "#304169b9",
    PFCs: "#7b7979",
    "SF6 & NF3": "#cec442"
    };
</script>


<div class="sector-composition">
    <h3>{getSectorDisplayName(composition.name)}</h3>

    <p>
        Sector's Net Emissions:
        {d3.format(",.1f")(composition.total)} kt CO₂e
    </p>

    <svg viewBox="0 0 600 28" class="stacked-chart">
        {#each stackedSegments as segment}
            <rect
                x={segment.start * 6}
                y="0"
                width={segment.percentage * 6}
                height="28"
                fill={gasColors[segment.gas]}
                opacity={activeGas === segment.gas ? 1 : 0.65}
                onclick={() => onGasSelect(segment.gas)}
                style="cursor: pointer; transition: opacity 200ms ease;"
            />
        {/each}
    </svg>


    <div class="gas-legend">
        {#each composition.gases.filter(d => d.emissions > 0) as gas}
            <button class="legend-item"
                role = "button"
                tabindex="0"
                onclick={() => {
    console.log("Legend clicked:", gas.gas);
    onGasSelect(gas.gas);
}}
                onkeydown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onGasSelect(gas.gas);
                    }
                }}
                style="cursor: pointer;"
            >
                <span
                    class="legend-color"
                    style:background-color={gasColors[gas.gas]}
                ></span>

                <div class="legend-text">
                    <span class="legend-name">{gas.gas}</span>
                    <span class="legend-value">
                        {d3.format(
                            gas.emissions < 0.1 ? ",.3f" :
                            gas.emissions < 1 ? ",.2f" : ",.1f"
                        )(gas.emissions)} kt CO₂e
                        ({d3.format(
                            gas.percentage < 0.1 ? ".3f" : ".1f"
                        )(gas.percentage)}%)
                    </span>
                </div>
            </button>
        {/each}
    </div>

</div>

<style>
    .sector-composition {
        background: white;
        border: 1px solid #d4e4df;
        border-radius: 12px;
        padding: 0px 12px;
        color: #0f4026;
    }

    .sector-composition h3 {
    margin: 6px 2px 2px;
    font-size: 20px;
    line-height: 1.2;
    }

    .sector-composition p {
    margin: 0;
    font-size: 15px;
    line-height: 1.2;
    }

    .stacked-chart {
        display: block;
        width: 100%;
        height: 28px;
        margin-top: 8px;
    }

    .gas-legend {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px 14px;
        width: 90%;
        margin: 12px auto 0;
        padding-left: 35px;
        text-align: left;
    }

    .legend-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
         background: none;
        border: none;
        padding: 0;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;

        position: relative;
        z-index: 2;
    }

    .legend-color {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        flex-shrink: 0;
        margin-top: 3px;
    }

    .legend-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .legend-name {
        font-size: 13px;
        font-weight: 600;
    }

    .legend-value {
        font-size: 12px;
        color: #466558;
        line-height: 1.3;
    }

    @media (max-width: 600px) {
        .gas-legend {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
</style>

