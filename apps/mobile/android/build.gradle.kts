allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// Register before evaluationDependsOn. file_picker 8.x pins compileSdk 34, and
// AGP rejects that once flutter_plugin_android_lifecycle is built against API 36.
subprojects {
    if (state.executed) {
        return@subprojects
    }
    afterEvaluate {
        extensions.findByName("android")?.let { android ->
            val setter = android.javaClass.methods.firstOrNull { method ->
                method.name == "setCompileSdk" && method.parameterCount == 1
            } ?: return@let
            val current = android.javaClass.methods
                .firstOrNull { it.name == "getCompileSdk" && it.parameterCount == 0 }
                ?.invoke(android) as? Int
            if (current == null || current < 36) {
                setter.invoke(android, 36)
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
