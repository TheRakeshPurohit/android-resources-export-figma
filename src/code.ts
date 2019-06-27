let command = figma.command;
let currentPage = figma.currentPage;
let selectedLayers = currentPage.selection;

const scaleToDpi = {
    1: 'mdpi',
    1.5: 'hdpi',
    2: 'xhdpi',
    3: 'xxhdpi',
    4: 'xxxhdpi'
};

if (command === 'new-nine-patch') {

    let hasNinePatchInSelectedLayers = selectedLayers.some(node => node.getPluginData('resourceType') === 'nine-patch');
    if (hasNinePatchInSelectedLayers) {
        alert('Selected layers have a nine-patch resource.');
    }
    else {

        // Get influence frame [top, right, bottom, left]
        let influenceFrame: number[] = [Infinity, -Infinity, -Infinity, Infinity];

        function traverse(node) {
            processLayer(node);
            if ("children" in node) {
                if (node.type !== "INSTANCE") {
                    for (const child of node.children) {
                        traverse(child)
                    }
                }
            }
        }

        function processLayer(layer) {
            const rotation = (<LayoutMixin> layer).rotation;
            const x = (<LayoutMixin> layer).x;
            const y = (<LayoutMixin> layer).y;
            const width = (<LayoutMixin> layer).width;
            const height = (<LayoutMixin> layer).height;
            const pi = Math.PI;
            let top: number;
            let right: number;
            let bottom: number;
            let left: number;

            if (rotation < 0) {
                top = y;
                right = x + Math.cos(rotation * pi / 180) * width;
                bottom = y + Math.cos(-rotation * pi / 180) * height + Math.sin(-rotation * pi / 180) * width;
                left = x - Math.sin(-rotation * pi / 180) * height;
            } else {
                top = y - Math.sin(rotation * pi / 180) * width;
                right = x + Math.cos(rotation * pi / 180) * width + Math.sin(rotation * pi / 180) * height;
                bottom = y + Math.cos(rotation * pi / 180) * height;
                left = x;
            }

            // Effects
            if ((<BlendMixin> layer).effects) {
                (<BlendMixin> layer).effects.forEach(effect => {
                    if (effect.type === 'DROP_SHADOW' && effect.visible === true) {
                        let xOffset = effect.offset.x;
                        let yOffset = effect.offset.y;
                        const blurRadius = effect.radius;
                        let shadowFrame: number[] = [top, right, bottom, left];
                        if (xOffset > 0) {
                            shadowFrame[1] += xOffset;
                        } else {
                            shadowFrame[3] += xOffset;
                        }
                        if (yOffset > 0) {
                            shadowFrame[2] += yOffset;
                        } else {
                            shadowFrame[0] += yOffset;
                        }
                        if (blurRadius > 0) {
                            if (yOffset < blurRadius) {
                                shadowFrame[0] -= blurRadius;
                            }
                            if (xOffset > -blurRadius) {
                                shadowFrame[1] += blurRadius;
                            }
                            if (yOffset > -blurRadius) {
                                shadowFrame[2] += blurRadius;
                            }
                            if (xOffset < blurRadius) {
                                shadowFrame[3] -= blurRadius;
                            }
                        }
                        top = Math.min(shadowFrame[0], top);
                        right = Math.max(shadowFrame[1], right);
                        bottom = Math.max(shadowFrame[2], bottom);
                        left = Math.min(shadowFrame[3], left);
                    }
                    if (effect.type === 'LAYER_BLUR' && effect.visible === true) {
                        const radius = effect.radius;
                        top -= radius;
                        right += radius;
                        bottom += radius;
                        left -= radius;
                    }
                });
            }

            influenceFrame[0] = Math.min(influenceFrame[0], top);
            influenceFrame[1] = Math.max(influenceFrame[1], right);
            influenceFrame[2] = Math.max(influenceFrame[2], bottom);
            influenceFrame[3] = Math.min(influenceFrame[3], left);
            influenceFrame[0] = Math.floor(influenceFrame[0]);
            influenceFrame[1] = Math.ceil(influenceFrame[1]);
            influenceFrame[2] = Math.ceil(influenceFrame[2]);
            influenceFrame[3] = Math.floor(influenceFrame[3]);
        }

        selectedLayers.forEach(layer => {
            traverse(layer);
        });

        // console.log(influenceFrame);

        // Group selection
        const lastSelectedLayer =  selectedLayers[selectedLayers.length - 1];
        const parent = lastSelectedLayer.parent;
        let groupContent = figma.group(selectedLayers, parent, parent.children.indexOf(lastSelectedLayer));
        groupContent.name = 'content';

        // Create patch lines
        let blackColorFill: Paint = {type: 'SOLID', color: {r: 0, g: 0, b: 0}};
        let leftPatch = figma.createRectangle();
        leftPatch.name = 'left';
        leftPatch.x = influenceFrame[3] - 1;
        leftPatch.y = influenceFrame[0];
        leftPatch.resize(1, influenceFrame[2] - influenceFrame[0]);
        leftPatch.fills = [blackColorFill];

        let topPatch = figma.createRectangle();
        topPatch.name = 'top';
        topPatch.x = influenceFrame[3];
        topPatch.y = influenceFrame[0] - 1;
        topPatch.resize(influenceFrame[1] - influenceFrame[3], 1);
        topPatch.fills = [blackColorFill];

        let rightPatch = figma.createRectangle();
        rightPatch.name = 'right';
        rightPatch.x = influenceFrame[1];
        rightPatch.y = influenceFrame[0];
        rightPatch.resize(1, influenceFrame[2] - influenceFrame[0]);
        rightPatch.fills = [blackColorFill];

        let bottomPath = figma.createRectangle();
        bottomPath.name = 'bottom';
        bottomPath.x = influenceFrame[3];
        bottomPath.y = influenceFrame[2];
        bottomPath.resize(influenceFrame[1] - influenceFrame[3], 1);
        bottomPath.fills = [blackColorFill];

        let groupPathIndex = groupContent.parent.children.indexOf(groupContent) + 1;
        let groupPatch = figma.group([leftPatch, topPatch, rightPatch, bottomPath], groupContent.parent, groupPathIndex);
        groupPatch.name = 'patch';
        groupPatch.x = influenceFrame[3] - 1;
        groupPatch.y = influenceFrame[0] - 1;

        // Group all
        let groupAllIndex = groupPatch.parent.children.indexOf(groupPatch) + 1;
        let groupAll = figma.group([groupContent, groupPatch], groupPatch.parent, groupAllIndex);
        groupAll.name = toAndroidResourceName(lastSelectedLayer.name);
        figma.currentPage.selection = [groupAll];

        // Set plugin data
        groupAll.setPluginData('resourceType', 'nine-patch');
    }

    figma.closePlugin();
}

if (command === 'export-nine-patch') {
    if (selectedLayers.length === 1) {
        let asset = selectedLayers[0];
        if (asset.getPluginData('resourceType') === 'nine-patch') {
            (async() => {

                let patch = (<ChildrenMixin> asset).findOne(node => node.name === 'patch');
                let content = (<ChildrenMixin> asset).findOne(node => node.name === 'content');
                if (!patch && !content) return;

                // Create slice
                let assetName = toAndroidResourceName(asset.name);
                let contentSlice = figma.createSlice();
                contentSlice.name = assetName;
                contentSlice.x = (<LayoutMixin> asset).x + 1;
                contentSlice.y = (<LayoutMixin> asset).y + 1;
                contentSlice.resize((<LayoutMixin> asset).width - 2, (<LayoutMixin> asset).height - 2);
                (<ChildrenMixin> content).appendChild(contentSlice);
                let exportSettings: ExportSettingsImage [] = [];
                for (let key in scaleToDpi) {
                    exportSettings.push({
                        format: 'PNG',
                        constraint: {type: 'SCALE', value: Number(key)}
                    });
                }
                contentSlice.exportSettings = exportSettings;

                let patchImageData = await (<ExportMixin> patch).exportAsync();
                let contentImages = [];
                for (const item of exportSettings) {
                    let contentImage = await (<ExportMixin> contentSlice).exportAsync(item);
                    let scale = item.constraint.value;
                    contentImages.push({
                        scale: scale,
                        width: Math.round(contentSlice.width * scale),
                        height: Math.round(contentSlice.height * scale),
                        path: 'drawable-' + scaleToDpi[scale] + '/' + assetName + '.9.png',
                        imageData: contentImage
                    });
                };

                figma.showUI(__html__, {visible: false, width: 400, height: 300});

                figma.ui.postMessage({
                    type: 'export-nine-patch',
                    name: assetName,
                    patchImage: {
                        width: (<LayoutMixin> patch).width,
                        height: (<LayoutMixin> patch).height,
                        imageData: patchImageData
                    },
                    contentImages
                });

                // Remove slice layer and close plugin
                const postMessage = await new Promise((resolve, reject) => {
                    figma.ui.onmessage = value => resolve(value);
                });
                if (postMessage === 'done') {
                    contentSlice.remove();
                    figma.closePlugin();
                }

            })();
        } else {
            alert('No a Android nine-patch resource.');
        }
    } else {
        alert('Please select 1 nine-patch resource.');
    }
}

function toAndroidResourceName(name: string) : string {
    // Latin to ascii
    var latinToAsciiMapping = {
        'ae': 'ä|æ|ǽ',
        'oe': 'ö|œ',
        'ue': 'ü',
        'Ae': 'Ä',
        'Ue': 'Ü',
        'Oe': 'Ö',
        'A': 'À|Á|Â|Ã|Ä|Å|Ǻ|Ā|Ă|Ą|Ǎ',
        'a': 'à|á|â|ã|å|ǻ|ā|ă|ą|ǎ|ª',
        'C': 'Ç|Ć|Ĉ|Ċ|Č',
        'c': 'ç|ć|ĉ|ċ|č',
        'D': 'Ð|Ď|Đ',
        'd': 'ð|ď|đ',
        'E': 'È|É|Ê|Ë|Ē|Ĕ|Ė|Ę|Ě',
        'e': 'è|é|ê|ë|ē|ĕ|ė|ę|ě',
        'G': 'Ĝ|Ğ|Ġ|Ģ',
        'g': 'ĝ|ğ|ġ|ģ',
        'H': 'Ĥ|Ħ',
        'h': 'ĥ|ħ',
        'I': 'Ì|Í|Î|Ï|Ĩ|Ī|Ĭ|Ǐ|Į|İ',
        'i': 'ì|í|î|ï|ĩ|ī|ĭ|ǐ|į|ı',
        'J': 'Ĵ',
        'j': 'ĵ',
        'K': 'Ķ',
        'k': 'ķ',
        'L': 'Ĺ|Ļ|Ľ|Ŀ|Ł',
        'l': 'ĺ|ļ|ľ|ŀ|ł',
        'N': 'Ñ|Ń|Ņ|Ň',
        'n': 'ñ|ń|ņ|ň|ŉ',
        'O': 'Ò|Ó|Ô|Õ|Ō|Ŏ|Ǒ|Ő|Ơ|Ø|Ǿ',
        'o': 'ò|ó|ô|õ|ō|ŏ|ǒ|ő|ơ|ø|ǿ|º',
        'R': 'Ŕ|Ŗ|Ř',
        'r': 'ŕ|ŗ|ř',
        'S': 'Ś|Ŝ|Ş|Š',
        's': 'ś|ŝ|ş|š|ſ',
        'T': 'Ţ|Ť|Ŧ',
        't': 'ţ|ť|ŧ',
        'U': 'Ù|Ú|Û|Ũ|Ū|Ŭ|Ů|Ű|Ų|Ư|Ǔ|Ǖ|Ǘ|Ǚ|Ǜ',
        'u': 'ù|ú|û|ũ|ū|ŭ|ů|ű|ų|ư|ǔ|ǖ|ǘ|ǚ|ǜ',
        'Y': 'Ý|Ÿ|Ŷ',
        'y': 'ý|ÿ|ŷ',
        'W': 'Ŵ',
        'w': 'ŵ',
        'Z': 'Ź|Ż|Ž',
        'z': 'ź|ż|ž',
        'AE': 'Æ|Ǽ',
        'ss': 'ß',
        'IJ': 'Ĳ',
        'ij': 'ĳ',
        'OE': 'Œ',
        'f': 'ƒ',
    };
    for (var i in latinToAsciiMapping) {
        var regexp = new RegExp(latinToAsciiMapping[i], 'g');
        name = name.replace(regexp, i);
    }
    // Remove no ascii character
    name = name.replace(/[^\u0020-\u007E]/g, '');
    // Remove not support character
    name = name.replace(/[\u0021-\u002B\u003A-\u0040\u005B-\u005E\u0060\u007B-\u007E]/g, '');
    // Remove Unix hidden file
    name = name.replace(/^\./, '');
    // Remove digit
    name = name.replace(/^\d+/, '');
    // Replace , - . to _
    name = name.replace(/[\u002C-\u002E\u005F]/g, '_');
    name = name.trim();
    // Replace space to _
    name = name.replace(/\s+/g, "_");
    name = name.toLowerCase();
    return name === '' ? 'untitled' : name;
}
