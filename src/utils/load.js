export async function loadModels(scene, urls) {
    const loadModelPromises = urls.map((url) => loadModel(scene, url));
    const results = await Promise.allSettled(loadModelPromises);
    const modelsDict = results.reduce((acc, result, index) => {
      const selector = urls[index].split("/").pop().replace(".glb", "");
      if (result.status === "fulfilled" && result.value?.meshes?.[0]) {
        acc[selector] = result.value.meshes[0];
      } else {
        console.warn(
          `[loadModels] Failed to load ${urls[index]} — continuing without it.`,
        );
        acc[selector] = null;
      }
      return acc;
    }, {});
    return modelsDict; // Return the dictionary containing all the models
}

async function loadModel(scene, url) {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "./assets/", url, scene);
    console.log(`Loaded ${url}`);
    return result;
}
