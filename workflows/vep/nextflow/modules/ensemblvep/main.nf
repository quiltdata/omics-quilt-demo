process ENSEMBLVEP {
    tag "$meta.id"
    cpus 2
    memory '8 GB'

    conda(params.enable_conda ? 'bioconda::ensembl-vep=106.1' : null)
    container "${ workflow.containerEngine == 'singularity' && !task.ext.singularity_pull_docker_container ?
        'https://depot.galaxyproject.org/singularity/ensembl-vep:106.1--pl5321h4a94de4_0' :
        'quay.io/biocontainers/ensembl-vep:106.1--pl5321h4a94de4_0' }"

    input:
    tuple val(meta), path(vcf)
    val   genome
    val   species
    val   cache_version
    path  cache
    path  fasta
    path  extra_files

    output:
    tuple val(meta), path('*.ann.vcf')     , optional:true, emit: vcf
    tuple val(meta), path('*.ann.tab')     , optional:true, emit: tab
    tuple val(meta), path('*.ann.json')    , optional:true, emit: json
    tuple val(meta), path('*.ann.vcf.gz')  , optional:true, emit: vcf_gz
    tuple val(meta), path('*.ann.tab.gz')  , optional:true, emit: tab_gz
    tuple val(meta), path('*.ann.json.gz') , optional:true, emit: json_gz
    path '*.summary.html'                  , emit: report
    path 'versions.yml'                    , emit: versions

    when:
    task.ext.when == null || task.ext.when

    script:
    String args = task.ext.args ?: ''
    String fileExtension = args.contains('--vcf') ? 'vcf' :
        (args.contains('--json') ? 'json' : args.contains('--tab') ? 'tab' : 'vcf')
    String compressOut = args.contains('--compress_output') ? '.gz' : ''
    String tprefix = task.ext.prefix ?: "${meta.id}"
    String dirCache = cache ? "\${PWD}/${cache}" : '/.vep'
    String reference = fasta ? "--fasta $fasta" : ''

    """
    vep \\
        -i $vcf \\
        -o ${tprefix}.ann.${fileExtension}${compressOut} \\
        $args \\
        $reference \\
        --assembly $genome \\
        --species $species \\
        --cache \\
        --cache_version $cache_version \\
        --dir_cache $dirCache \\
        --fork $task.cpus \\
        --stats_file ${tprefix}.summary.html \\

    cat <<-END_VERSIONS > versions.yml
    "${task.process}":
        ensemblvep: \$( echo \$(vep --help 2>&1) | sed 's/^.*Versions:.*ensembl-vep : //;s/ .*\$//')
    END_VERSIONS
    """

    stub:
    String sprefix = task.ext.prefix ?: "${meta.id}"
    """
    touch ${sprefix}.ann.vcf
    touch ${sprefix}.ann.tab
    touch ${sprefix}.ann.json
    touch ${sprefix}.ann.vcf.gz
    touch ${sprefix}.ann.tab.gz
    touch ${sprefix}.ann.json.gz
    touch ${sprefix}.summary.html

    cat <<-END_VERSIONS > versions.yml
    "${task.process}":
        ensemblvep: \$( echo \$(vep --help 2>&1) | sed 's/^.*Versions:.*ensembl-vep : //;s/ .*\$//')
    END_VERSIONS
    """
}
