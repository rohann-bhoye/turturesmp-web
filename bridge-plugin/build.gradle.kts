plugins {
    java
}

group = "org.turturesmp"
version = "1.0.0"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://repo.extendedclip.com/releases/")
}

dependencies {
    // Provided by the server at runtime.
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
    compileOnly("com.google.code.gson:gson:2.11.0") // Paper bundles Gson; this is only for the compiler.
    // Soft dependencies (optional at runtime, never shaded).
    compileOnly("net.luckperms:api:5.4")
    compileOnly("me.clip:placeholderapi:2.11.6")
    // Vault and Floodgate are accessed via reflection, so no compile dependency is needed.
}

tasks {
    compileJava {
        options.release.set(21)
        options.encoding = "UTF-8"
    }
    processResources {
        filesMatching("plugin.yml") {
            expand("version" to project.version)
        }
    }
    jar {
        archiveBaseName.set("TurtureBridge")
    }
}
