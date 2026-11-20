<script>
    import * as d3 from "d3";
    import { onMount } from "svelte";
    import { Tween } from "svelte/motion";
    import { getSectorDisplayName } from "./utils/sectorLabels.js";
    import SectorGasComp from "./SectorGasComp.svelte";
    import { tick } from "svelte";

    let data = $state([]);
    let activeGas = $state("CO2");
    let previousGas = $state("CO2");
    let hoveredSector = $state(null);
    let selectedSector = $state(null);
    const switchAnimation = new Tween(1, {
        duration: 650,
        easing: d3.easeCubicInOut
    });

    let scrollProgress = $state(0);

    const clamp01 = value => Math.max(0, Math.min(1, value));

    let revealProgress = $derived(
        clamp01(scrollProgress / 0.20)
    );

    let dimProgress = $derived(
        clamp01((scrollProgress - 0.45) / 0.15)
    );

    let zoomProgress = $derived(
        clamp01((scrollProgress - 0.60) / 0.20)
    );

    let sectorProgress = $derived(
        clamp01((scrollProgress - 0.80) / 0.20)
    );

    let scrollContainer;

    onMount(async () => {
        data = await d3.csv(
            `${import.meta.env.BASE_URL}data/gas_sector_2024.csv`,
            d => ({
                sector: d["Sector Classification"],
                gas: d["Gas Type"],
                emissions: +d["Emissions (kilotonnes)"]
            })
        );
    });

    onMount(() => {
        function updateScroll() {
            if (!scrollContainer) return;

            const rect = scrollContainer.getBoundingClientRect();
            const scrollDistance = scrollContainer.offsetHeight - window.innerHeight;

            if (scrollDistance <= 0) return;

            scrollProgress = Math.max(
                0,
                Math.min(1, -rect.top / scrollDistance)
            );
        }

        window.addEventListener("scroll", updateScroll, { passive: true });
        window.addEventListener("resize", updateScroll);

        updateScroll();

        return () => {
            window.removeEventListener("scroll", updateScroll);
            window.removeEventListener("resize", updateScroll);
        };
    });

    let hierarchyData = $derived({
        name: "Total GHG",
        children: Array.from(
            d3.group(data, d => d.gas),
            ([gas, sectors]) => ({
                name: gas,
                children: sectors
                    .filter(d => d.emissions > 0)
                    .map(d => ({
                        name: d.sector,
                        value: d.emissions
                    }))
            })
        )
    });

    const width = 800;
    const height = 800;
    const gasColors = {
        "CO2": "#44c0c0ca",     
        "CH4": "#579499c3",       
        "N2O": "#f9a01cc1",       
        "HFCs": "#304169b9",      
        "PFCs": "#7b7979",      
        "SF6 & NF3": "#cec442"  
    };

    const gasOrder = [
        "CO2", "CH4", "N2O",
        "HFCs", "PFCs", "SF6 & NF3"
    ];

    let sideGases = $derived(
        gasOrder.filter(name => name !== activeGas)
    );

    const sideX = 880;
    const sideStartY = 60;
    const sideSpacing = 115;
    const sideRadii = {
    "CO2": 85,
    "CH4": 70,
    "N2O": 55,
    "HFCs": 40,
    "PFCs": 32,
    "SF6 & NF3": 28
    };

    function selectGas(name) {
    if (name === activeGas) return;

    hoveredSector = null;
    selectedSector = null;

    previousGas = activeGas;
    activeGas = name;

    switchAnimation.set(0, { duration: 0 });
    switchAnimation.set(1);
    }

    function selectSectorGas(name) {
    if (name === activeGas) return;

    hoveredSector = null;

    previousGas = activeGas;
    activeGas = name;

    switchAnimation.set(0, { duration: 0 });
    switchAnimation.set(1);
    }

    let root = $derived.by(() => {
        if (data.length === 0) return null;

        return d3.pack()
            .size([width, height])
            .padding(4)(
                d3.hierarchy(hierarchyData)
                    .sum(d => d.value || 0)
                    .sort((a, b) => b.value - a.value)
            );
    });

    let gasRoot = $derived.by(() => {
    if (!root) return null;

    return d3.pack()
        .size([width, height])
        .padding(4)(
            d3.hierarchy({
                name: "Total GHG",
                children: root.children.map(gas => ({
                    name: gas.data.name,
                    value: gas.value
                }))
            })
            .sum(d => d.value || 0)
            .sort((a, b) => b.value - a.value)
        );
    });

    let sectorPieLayouts = $derived.by(() => {
        if (data.length === 0) return {};

        const layouts = {};

        for (const [gasName, records] of d3.group(data, d => d.gas)) {
            const sectors = records
                .filter(d => d.emissions > 0)
                .map(d => ({
                    name: d.sector,
                    value: d.emissions
                }));

            layouts[gasName] = d3.pie()
                .value(d => d.value)
                .sort((a, b) => b.value - a.value)(sectors);
        }

        return layouts;
    });

    let selectedGas = $derived(
        gasRoot?.children?.find(gas => gas.data.name === activeGas)
    );

    let zoomTransform = $derived.by(() => {
        if (!selectedGas) {
            return { x: 0, y: 0, scale: 1 };
        }

        const targetScale = 330 / selectedGas.r;

        return {
            x: (width / 2 - selectedGas.x * targetScale) * zoomProgress,
            y: (height / 2 - selectedGas.y * targetScale) * zoomProgress,
            scale: 1 + (targetScale - 1) * zoomProgress
        };
    });

    
    function getGasTarget(gas, selectedName) {
    if (gas.data.name === selectedName) {
        return {
            x: width / 2,
            y: height / 2,
            r: 330
        };
    }

    const otherGases = gasOrder.filter(name => name !== selectedName);
    const index = otherGases.indexOf(gas.data.name);
    const previousGases = otherGases.slice(0, index);

    return {
        x: sideX,
        y:
            sideStartY +
            sideRadii[gas.data.name] +
            previousGases.reduce(
                (total, name) => total + 2 * sideRadii[name] + 20,
                0
            ),
        r: sideRadii[gas.data.name]
    };
}

    function gasTransform(gas) {
        const initial = {
            x: gas.x,
            y: gas.y,
            r: gas.r
        };

        const oldTarget = getGasTarget(gas, previousGas);
        const newTarget = getGasTarget(gas, activeGas);

        const t = switchAnimation.current;

        const animatedTarget = {
            x: oldTarget.x + (newTarget.x - oldTarget.x) * t,
            y: oldTarget.y + (newTarget.y - oldTarget.y) * t,
            r: oldTarget.r + (newTarget.r - oldTarget.r) * t
        };

        const progress = zoomProgress;

        const centerX = initial.x + (animatedTarget.x - initial.x) * progress;
        const centerY = initial.y + (animatedTarget.y - initial.y) * progress;
        const radius = initial.r + (animatedTarget.r - initial.r) * progress;

        const scale = radius / gas.r;

        const x = centerX - gas.x * scale;
        const y = centerY - gas.y * scale;

        return `translate(${x}, ${y}) scale(${scale})`;
    }


    const gasLabels = {
        "CO2": "CO₂",
        "CH4": "CH₄",
        "N2O": "N₂O",
        "HFCs": "HFCs",
        "PFCs": "PFCs",
        "SF6 & NF3": "SF₆ & NF₃"
    };

    const smallGasLabelY = {
    "SF6 & NF3": 95,
    "PFCs": 145,
    "HFCs": 195
    };

    
    let sideLabelX = $derived(
        sideX +
        Math.max(...sideGases.map(name => sideRadii[name])) +
        25
    );

    const sectorLabelThreshold = 10;

    function wrapSectorName(name, maxChars = 25) {
        if (name.length <= maxChars) return [name];

        const words = name.split(" ");
        const lines = [""];

        for (const word of words) {
            const currentLine = lines[lines.length - 1];

            if ((currentLine + " " + word).trim().length <= maxChars) {
                lines[lines.length - 1] = (currentLine + " " + word).trim();
            } else {
                lines.push(word);
            }
        }

        // Keep the label to a maximum of two lines
        if (lines.length > 2) {
            return [lines[0], lines.slice(1).join(" ")];
        }

        return lines;
    }

    let sectorPanelElement;
    let transitionBox = $state(null);
    let sectorTransitioning = $state(false);

    let tooltipOrigin = null;
    let transitionRun = 0;

    const DETAIL_DURATION = 500;

    function getTooltipRect() {
        const tooltip = document.querySelector(".sector-tooltip rect");
        return tooltip?.getBoundingClientRect() ?? null;
    }

    function getPanelRect() {
        return sectorPanelElement?.getBoundingClientRect() ?? null;
    }

    function rectValues(rect) {
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    async function animateDetailBox(from, to, opening) {
        const run = ++transitionRun;

        transitionBox = {
            ...from,
            opacity: 1
        };

        await tick();

        const start = performance.now();

        return new Promise((resolve) => {
            function frame(now) {
                if (run !== transitionRun) {
                    resolve();
                    return;
                }

                const progress = Math.min(
                    (now - start) / DETAIL_DURATION,
                    1
                );

                const eased =  1 - Math.pow(1 - progress, 3);

                const interpolate = (a, b) =>
                    a + (b - a) * eased;

                transitionBox = {
                    left: interpolate(from.left, to.left),
                    top: interpolate(from.top, to.top),
                    width: interpolate(from.width, to.width),
                    height: interpolate(from.height, to.height),
                    opacity: opening
                        ? 1 - progress
                        : progress
                };

                if (opening && progress >= 0.55 && sectorTransitioning) {
                    sectorTransitioning = false;
                }

                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }

            requestAnimationFrame(frame);
        });
    }

    async function openSectorDetail(sectorName) {
    if (sectorTransitioning) return;

    const tooltipRect = getTooltipRect();

    if (!tooltipRect) {
        selectedSector = sectorName;
        hoveredSector = null;
        return;
    }

    tooltipOrigin = rectValues(tooltipRect);

    sectorTransitioning = true;
    selectedSector = sectorName;
    hoveredSector = null;

    await tick();

    const panelRect = getPanelRect();

    if (!panelRect) {
        sectorTransitioning = false;
        return;
    }

    await animateDetailBox(
        tooltipOrigin,
        rectValues(panelRect),
        true
    );

    transitionBox = null;
    sectorTransitioning = false;
    hoveredSector = null;
    }

    async function closeSectorDetail() {
        if (sectorTransitioning || !selectedSector) return;

        sectorTransitioning = true;

        const panelRect = getPanelRect();

        if (panelRect && tooltipOrigin) {
            await animateDetailBox(
                rectValues(panelRect),
                tooltipOrigin,
                false
            );
        }

        transitionBox = null;
        selectedSector = null;
        hoveredSector = null;
        tooltipOrigin = null;
        sectorTransitioning = false;
    }

</script>

<section class="gas-composition" bind:this={scrollContainer}>
    <div class="sticky-content">

        {#if gasRoot}
            <svg viewBox="-275 -100 1350 1000">
                <defs>
                    <radialGradient id="ghg-gradient" cx="50%" cy="50%" r="60%">
                        <stop offset="0%" stop-color="#78a781" stop-opacity="0.85" />
                        <stop offset="55%" stop-color="#a5c9a9" stop-opacity="0.65" />
                        <stop offset="85%" stop-color="#c9e2cd" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#c9e2cd" stop-opacity="0" />
                    </radialGradient>
                </defs>

                <g>
                    <!-- Initial gradient sphere -->
                    <circle
                        cx={gasRoot.x}
                        cy={gasRoot.y}
                        r={gasRoot.r}
                        fill="url(#ghg-gradient)"
                        opacity={1 - zoomProgress}
                    />

                    <!-- Six gas circles -->
                    {#each gasRoot.children ?? [] as gas (gas.data.name)}
                        {@const isSelected = gas.data.name === activeGas}
          
                    <g
                        class="gas-group"
                        transform={gasTransform(gas)}
                        opacity={
                            revealProgress *
                            (isSelected
                                ? 1
                                : 1 - dimProgress * 0.8 + zoomProgress * 0.8)
                        }
                    >

                        <circle
                                cx={gas.x}
                                cy={gas.y}
                                r={gas.r}
                                fill={gasColors[gas.data.name]}
                            />

                        <!-- Sector pie chart inside the selected gas -->
                        {#if isSelected && sectorPieLayouts[gas.data.name]}
                            {@const slices = sectorPieLayouts[gas.data.name]}

                            <g opacity={sectorProgress * switchAnimation.current}>
                                {#each slices as slice (slice.data.name)}
                                    {@const percentage = slice.value / gas.value * 100}

                                    {@const arc = d3.arc()
                                        .innerRadius(0)
                                        .outerRadius(gas.r)
                                        .startAngle(slice.startAngle - Math.PI / 2)
                                        .endAngle(slice.endAngle - Math.PI / 2)}

                                    {@const labelRadiusFactor =
                                        percentage >= 75 ? 0.5 : 4 / 3}
                                    {@const labelArc = d3.arc()
                                        .innerRadius(0)
                                        .outerRadius(gas.r * labelRadiusFactor)
                                        .startAngle(slice.startAngle - Math.PI / 2)
                                        .endAngle(slice.endAngle - Math.PI / 2)}

                                    {@const [centroidX, centroidY] = labelArc.centroid()}
                                    {@const isSingleSector = slices.length === 1}
                                    {@const labelX = isSingleSector ? gas.x : gas.x + centroidX}
                                    {@const labelY = isSingleSector ? gas.y : gas.y + centroidY}
                                    {@const highlightedSector =
                                        hoveredSector?.gas === gas.data.name
                                            ? hoveredSector.name
                                            : selectedSector}
                                    {@const isDimmed =
                                        highlightedSector !== null &&
                                        highlightedSector !== slice.data.name}
                                    <g>
                                        <path
                                            d={arc()}
                                            transform={`translate(${gas.x}, ${gas.y})`}
                                            fill={d3.interpolateRgb(
                                                gasColors[gas.data.name],
                                                "#ffffff"
                                            )(
                                                0.15 + (slice.index % 5) * 0.12
                                            )}
                                            filter={isDimmed ? "brightness(0.65)" : "none"}
                                            stroke="#ffffff"
                                            stroke-width={1 / zoomTransform.scale}
                                            onpointerenter={() => {
                                                const angle = (slice.startAngle + slice.endAngle) / 2
                                                    - Math.PI / 2;

                                                const radius = 330 + 30;

                                                hoveredSector = {
                                                    gas: gas.data.name,
                                                    name: slice.data.name,
                                                    emissions: slice.value,
                                                    percentage: slice.value / gas.value * 100,
                                                    x: 400 + Math.sin(angle) * radius,
                                                    y: 400 - Math.cos(angle) * radius
                                                };
                                            }}
                                            onpointerleave={() => {
                                                hoveredSector = null;
                                            }}
                                            style="cursor: pointer;"

                                            onclick={() => {
                                                if (sectorTransitioning) return;

                                                if (selectedSector === slice.data.name) {
                                                    closeSectorDetail();
                                                } else {
                                                    openSectorDetail(slice.data.name);
                                                }
                                            }}
                                        />
                                                                              
                                        {#if percentage >= sectorLabelThreshold}
                                            {@const nameLines = wrapSectorName(
                                                    getSectorDisplayName(slice.data.name),
                                                    22
                                                )}
                                            <g filter={isDimmed ? "brightness(0.65)" : "none"}>
                                                <text
                                                    x={labelX}
                                                    y={labelY - (nameLines.length === 2 ? 18 : 8) / zoomTransform.scale}
                                                    text-anchor="middle"
                                                    fill="#010f09"
                                                    font-size={17 / zoomTransform.scale}
                                                    font-weight="600"
                                                    pointer-events="none"
                                                >
                                                    {#each nameLines as line, i}
                                                        <tspan
                                                            x={labelX}
                                                            dy={i === 0 ? 0 : 19 / zoomTransform.scale}
                                                        >
                                                            {line}
                                                        </tspan>
                                                    {/each}
                                                </text>
                                                <text
                                                    x={labelX}
                                                    y={labelY + (nameLines.length === 2 ? 24 : 15) 
                                                        / zoomTransform.scale}
                                                    text-anchor="middle"
                                                    fill="#000503"
                                                    font-size={17 / zoomTransform.scale}
                                                    font-weight="600"
                                                    pointer-events="none"
                                                >
                                                    {d3.format(".1f")(percentage)}%
                                                </text>
                                            </g>
                                        {/if}
                                    </g>
                                {/each}

                            </g>
                        {/if}

                            <!-- Original overview labels -->
                            {#if gas.r > 70}
                                <g opacity={1 - zoomProgress}>
                                    <text
                                        x={gas.x}
                                        y={gas.y - 10}
                                        text-anchor="middle"
                                        fill="#0f4026"
                                        font-size="32"
                                        font-weight="600"
                                    >
                                        {gasLabels[gas.data.name]}
                                    </text>

                                    <text
                                        x={gas.x}
                                        y={gas.y + 30}
                                        text-anchor="middle"
                                        fill="#0f4026"
                                        font-size="28"
                                    >
                                        {d3.format(".1f")(gas.value / gasRoot.value * 100)}%
                                    </text>
                                </g>
                            {/if}

                            <!-- Selected gas: total emissions -->                                                
                            {#if isSelected}
                                <g opacity={zoomProgress}>
                                    <text
                                        x={gas.x}
                                        y={gas.y - gas.r - 45 / zoomTransform.scale}
                                        text-anchor="middle"
                                        fill="#0f4026"
                                        font-size={32 / zoomTransform.scale}
                                        font-weight="600"
                                    >
                                        {gasLabels[gas.data.name]}
                                    </text>

                                    <text
                                        x={gas.x}
                                        y={gas.y - gas.r - 12 / zoomTransform.scale}
                                        text-anchor="middle"
                                        fill="#0f4026"
                                        font-size={24 / zoomTransform.scale}
                                    >
                                        {d3.format(",.0f")(gas.value)} kt CO₂e
                                    </text>
                                </g>
                            {/if}
                    </g>
                    {/each}

                    <!-- Hovered sector information -->
                    {#if hoveredSector && hoveredSector.gas === activeGas && sectorProgress > 0}
                        <g
                            class="sector-tooltip"
                            transform={`translate(${hoveredSector.x}, ${hoveredSector.y})`}
                            pointer-events="none"
                        >
                            <rect
                                x={hoveredSector.x > 400 ? 10 : -270}
                                y={-45}
                                width={260}
                                height={90}
                                rx={8}
                                fill="#fefefeed"
                                stroke="#919f9bf1"
                                stroke-width="1"
                            />

                            <text
                                x={hoveredSector.x > 400 ? 22 : -258}
                                y={-17}
                                fill="#0f4026"
                                font-size="16"
                                font-weight="600"
                            >
                                {getSectorDisplayName(hoveredSector.name)}
                            </text>

                            <text
                                x={hoveredSector.x > 400 ? 22 : -258}
                                y={10}
                                fill="#0f4026"
                                font-size="17"
                                font-weight="500"
                            >
                                {d3.format(",.1f")(hoveredSector.emissions)} kt CO₂e
                            </text>

                            <text
                                x={hoveredSector.x > 400 ? 22 : -258}
                                y={35}
                                fill="#0f4026"
                                font-size="16"
                                font-weight="500"
                            >
                                {d3.format(".1f")(hoveredSector.percentage)}%
                            </text>
                        </g>
                    {/if}

                    <!-- Small-gas labels in the national overview -->
                    <g opacity={revealProgress * (1 - dimProgress)}>
                        {#each gasRoot.children?.filter(gas => gas.r <= 70) ?? [] as gas}
                            <line
                                x1={gas.x}
                                y1={gas.y - 3}
                                x2={gas.x + gas.r + 5}
                                y2={smallGasLabelY[gas.data.name] + 5}
                                stroke="#0f4026"
                                stroke-width="2"
                            />

                            <text
                                x={gas.x + gas.r + 5}
                                y={smallGasLabelY[gas.data.name]}
                                fill="#0f4026"
                                font-size="18"
                            >
                                <tspan font-weight="600">
                                    {gasLabels[gas.data.name]}
                                </tspan>
                                <tspan font-weight="400">
                                    ({d3.format(
                                        gas.value / gasRoot.value * 100 < 0.1
                                            ? ".3f"
                                            : ".2f"
                                    )(gas.value / gasRoot.value * 100)}%)
                                </tspan>
                            </text>
                        {/each}
                    </g>

                    <!-- Right-side gas navigation -->
                    {#if zoomProgress > 0}
                        <g opacity={zoomProgress}>
                            {#each gasRoot.children?.filter(g => g.data.name !== activeGas) ?? [] as gas}
                                {@const index = sideGases.indexOf(gas.data.name)}
                                {@const previousGases = sideGases.slice(0, index)}
                                {@const targetY =
                                    sideStartY +
                                    sideRadii[gas.data.name] +
                                    previousGases.reduce(
                                        (total, name) =>
                                            total + 2 * sideRadii[name] + 20,
                                        0
                                    )
                                }

                                <g  class="gas-nav-item"
                                    role="button"
                                    tabindex="0"
                                    aria-label={`Explore ${gasLabels[gas.data.name]} emissions`}
                                    onclick={() => selectGas(gas.data.name)}
                                    onkeydown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            selectGas(gas.data.name);
                                        }
                                    }}
                                    style="cursor: pointer;"
                                >
                                    <!-- Invisible clickable area -->
                                    <rect
                                        x={sideX - sideRadii[gas.data.name] - 10}
                                        y={targetY - sideRadii[gas.data.name] - 10}
                                        width={sideLabelX + 220 - (sideX - sideRadii[gas.data.name] - 10)}
                                        height={sideRadii[gas.data.name] * 2 + 20}
                                        fill="transparent"
                                    />

                                    <text
                                        x={sideLabelX}
                                        y={targetY - 5}
                                        fill="#0f4026"
                                        font-size="21"
                                        font-weight="600"
                                    >
                                        {gasLabels[gas.data.name]}
                                    </text>

                                    <text
                                        x={sideLabelX}
                                        y={targetY + 23}
                                        fill="#0f4026"
                                        font-size="20"
                                    >
                                        {d3.format(",.1f")(gas.value)} kt CO₂e
                                    </text>
                                </g>
                            {/each}
                        </g>
                    {/if}

                    <!-- Initial total emissions label -->
                    <g opacity={Math.max(0, 1 - revealProgress * 5)}>
                        <text
                            x={gasRoot.x}
                            y={gasRoot.y - 35}
                            text-anchor="middle"
                            fill="#0f4026"
                            font-size="25"
                            font-family="Georgia, serif"
                        >
                            Total GHG Emissions
                        </text>

                        <text
                            x={gasRoot.x}
                            y={gasRoot.y + 15}
                            text-anchor="middle"
                            fill="#0f4026"
                            font-size="42"
                            font-weight="600"
                        >
                            {d3.format(",.0f")(gasRoot.value)} kt CO₂e
                        </text>

                        <text
                            x={gasRoot.x}
                            y={gasRoot.y + 55}
                            text-anchor="middle"
                            fill="#0f4026"
                            font-size="20"
                        >
                            Ireland · 2024
                        </text>
                    </g>
            </svg>
        {/if}

        <!-- Shared space beneath the sphere: explanation or sector bar chart -->
        <div class="scroll-explanation">
            {#if !selectedSector}
                <p
                    class="explanation-text"
                    class:visible={revealProgress > 0 && zoomProgress === 0}
                >
                    Because these greenhouse gases differ in their warming
                    effects, emissions are measured in
                    <strong>kilotonnes of carbon dioxide equivalent
                    (kt CO₂e)</strong>, allowing us to compare their impact
                    on a standardized scale.
                </p>

                <p
                    class="explanation-text"
                    class:visible={zoomProgress > 0}
                >
                    Different economic activities also produce different
                    combinations of greenhouse gases. <strong>Click on different sectors
                    or gas types to explore.</strong>
                </p>
            {/if}

            {#if selectedSector}
                <div class="sector-detail"
                    class:transitioning={sectorTransitioning}
                    bind:this={sectorPanelElement}
                >
                    <button
                        type="button"
                        class="close-sector"
                        aria-label="Close sector details"
                        onclick={closeSectorDetail}
                        disabled={sectorTransitioning}
                    >
                        ×
                    </button>

                    <SectorGasComp
                        sector={selectedSector}
                        {data}
                        {activeGas}
                        onGasSelect={selectSectorGas}
                    />
                </div>
            {/if}
        </div>

        {#if transitionBox}
            <div
                class="detail-transition-box"
                style:left={`${transitionBox.left}px`}
                style:top={`${transitionBox.top}px`}
                style:width={`${transitionBox.width}px`}
                style:height={`${transitionBox.height}px`}
                style:opacity={transitionBox.opacity}
            ></div>
        {/if}
    </div>
</section>

<style>

.gas-composition {
    height: 500vh;
    position: relative;
}

.sticky-content {
    position: sticky;
    top: 0;
    height: 100vh;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;

    text-align: center;
    box-sizing: border-box;
}

.sticky-content h2 {
    margin: 0 20px 20px;
}

.gas-composition > .sticky-content > svg {
    width: 100%;
    max-width: 950px;
    max-height: 70vh;
    height: auto;
    display: block;
}


.gas-nav-item {
    cursor: pointer;
}

.gas-nav-item text {
    transition: fill 200ms ease;
}

.gas-nav-item:hover text,
.gas-nav-item:focus-visible text {
    fill: #159b91;
    text-decoration: underline;
}

.gas-nav-item:focus-visible {
    outline: 2px solid #159b91;
}

.sector-detail {
    position: relative;
    flex-shrink: 0;
    width: min(700px, 100%);
    margin: 0 auto;
    z-index: 10;
}

.detail-transition-box {
    position: fixed;
    z-index: 100;
    pointer-events: none;

    box-sizing: border-box;
    background: #fefefeed;
    border: 1px solid #919f9bf1;
    border-radius: 8px;
}

.sector-detail.transitioning {
    visibility: hidden;
}

.close-sector {
    position: absolute;
    top: 12px;
    right: 16px;
    z-index: 10;

    background: transparent;
    border: none;
    color: #0f4026;
    font-size: 26px;
    line-height: 1;
    cursor: pointer;
}

.close-sector:hover {
    opacity: 0.6;
}

.scroll-explanation {
    position: relative;
    width: min(750px, 90vw);
    min-height: 110px;
    margin: 10px auto 0;
    text-align: center;
    pointer-events: auto;
    z-index: 2;
}

.explanation-text {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    margin: 0;

    font-family: var(--sans);
    font-size: 18px;
    line-height: 1.6;
    color: var(--text);

    opacity: 0;
    visibility: hidden;
    transform: translateY(25px);

    transition:
        opacity 0.5s ease,
        transform 0.7s ease,
        visibility 0.5s;
}

.explanation-text.visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

@media (max-width: 768px) {
    .scroll-explanation {
        width: 90vw;
    }

    .explanation-text {
        font-size: 16px;
    }
}

</style>
